// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CojamToken} from "./CojamToken.sol";

/// @title Cojam migration: old CT to new CT, 1:1, each swap locked for 7 days
/// @notice Holders call `migrate(amount)` after approving old CT. The contract
/// pulls the old CT, credits exactly what arrived, and opens a lot that unlocks
/// 7 days later. `claim(maxLots)` pays matured lots in new CT.
///
/// There is no admin key. Every parameter is immutable. After the window ends
/// and the grace period passes, anyone may call `sweep()`, which sends only the
/// reserve that no lot is owed to the immutable `TREASURY`.
///
/// Received old CT stays in this contract forever: no function can move it.
contract CojamMigration is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Length of the migration window, counted from START.
    uint256 public constant WINDOW = 365 days;
    /// @notice Each lot unlocks this long after its migrate call.
    uint256 public constant LOCK_PERIOD = 7 days;
    /// @notice Upper bound for the grace period, to catch unit mistakes at deploy.
    uint256 public constant MAX_GRACE_PERIOD = 365 days;
    /// @notice Both tokens use 18 decimals, so 1 old base unit = 1 new base unit.
    uint8 public constant DECIMALS = 18;

    IERC20 public immutable OLD_TOKEN;
    IERC20 public immutable NEW_TOKEN;
    address public immutable TREASURY;
    uint256 public immutable START;
    uint256 public immutable END;
    uint256 public immutable SWEEP_OPENS_AT;

    /// @dev One storage slot. `amount` fits: the whole supply is below 2^92.
    struct Lot {
        uint128 amount;
        uint64 unlockAt;
    }

    mapping(address user => Lot[]) private _lots;
    /// @notice Lots with an id below this index are claimed. Because LOCK_PERIOD
    /// is constant and block time never decreases, a user's lots unlock in id order.
    mapping(address user => uint256) public nextClaimIndex;

    /// @notice Old CT credited through `migrate` (what actually arrived).
    uint256 public totalMigrated;
    /// @notice New CT owed to lots that are not claimed yet.
    uint256 public totalOwed;
    /// @notice New CT paid out by `claim`.
    uint256 public totalClaimed;
    /// @notice New CT sent to TREASURY by `sweep`.
    uint256 public totalSwept;

    event Migrated(
        address indexed user,
        uint256 indexed lotId,
        uint256 oldAmount,
        uint256 newAmount,
        uint256 unlockAt
    );
    event Claimed(address indexed user, uint256 indexed lotId, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    error ZeroAddress();
    error StartInPast();
    error GracePeriodTooLong();
    error DecimalsMismatch();
    error SupplyMismatch();
    error ZeroAmount();
    error NotStarted();
    error WindowClosed();
    error NothingReceived();
    error ReceivedMoreThanSent();
    error ReserveExhausted();
    error NothingToClaim();
    error SweepNotOpen();
    error NothingToSweep();

    /// @param oldToken    Old CT (Kaia mainnet 0x7f223b1607171b81ebd68d22f1ca79157fd4a44b).
    /// @param treasury    Receives the unowed reserve after END + gracePeriod (the new multisig).
    /// @param start       Unix time the window opens. END = start + 365 days.
    /// @param gracePeriod Seconds after END before `sweep` opens.
    constructor(IERC20 oldToken, address treasury, uint256 start, uint256 gracePeriod) {
        if (address(oldToken) == address(0) || treasury == address(0)) revert ZeroAddress();
        if (start < block.timestamp) revert StartInPast();
        if (gracePeriod > MAX_GRACE_PERIOD) revert GracePeriodTooLong();
        if (IERC20Metadata(address(oldToken)).decimals() != DECIMALS) revert DecimalsMismatch();

        // The new token is created here and its whole supply is minted to this
        // contract in the same transaction, so no other address ever holds it first.
        CojamToken token = new CojamToken(address(this));
        if (token.decimals() != DECIMALS) revert DecimalsMismatch();
        if (token.totalSupply() != oldToken.totalSupply()) revert SupplyMismatch();

        OLD_TOKEN = oldToken;
        NEW_TOKEN = IERC20(address(token));
        TREASURY = treasury;
        START = start;
        END = start + WINDOW;
        SWEEP_OPENS_AT = start + WINDOW + gracePeriod;
    }

    // ------------------------------------------------------------------
    // Holder actions
    // ------------------------------------------------------------------

    /// @notice Swap `amount` old CT for the same amount of new CT, locked for 7 days.
    /// @dev Requires a prior `approve(this, amount)` on old CT (old CT has no permit).
    /// The external call happens before the state writes on purpose: the credit
    /// is the measured balance change, which only exists after the transfer.
    /// `nonReentrant` closes the window that this ordering would otherwise open.
    /// @return lotId Index of the new lot in the caller's lot list.
    function migrate(uint256 amount) external nonReentrant returns (uint256 lotId) {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp < START) revert NotStarted();
        if (block.timestamp >= END) revert WindowClosed();

        uint256 balanceBefore = OLD_TOKEN.balanceOf(address(this));
        OLD_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = OLD_TOKEN.balanceOf(address(this));

        if (balanceAfter <= balanceBefore) revert NothingReceived();
        uint256 received = balanceAfter - balanceBefore;
        if (received > amount) revert ReceivedMoreThanSent();

        // 1:1 with equal decimals: no scaling, no rounding, no dust.
        uint256 newAmount = received;
        if (newAmount > availableReserve()) revert ReserveExhausted();

        uint256 unlockAt = block.timestamp + LOCK_PERIOD;
        Lot[] storage lots = _lots[msg.sender];
        lotId = lots.length;
        lots.push(Lot({amount: SafeCast.toUint128(newAmount), unlockAt: SafeCast.toUint64(unlockAt)}));

        totalMigrated += received;
        totalOwed += newAmount;

        emit Migrated(msg.sender, lotId, received, newAmount, unlockAt);
    }

    /// @notice Pay the caller's matured lots, oldest first, at most `maxLots` of them.
    /// @dev Bounded by `maxLots`, so a wallet with very many lots can always claim
    /// in several transactions. Stops at the first lot that is still locked.
    /// Works at any time, including long after the window has closed.
    /// @return amount New CT sent to the caller.
    function claim(uint256 maxLots) external nonReentrant returns (uint256 amount) {
        Lot[] storage lots = _lots[msg.sender];
        uint256 i = nextClaimIndex[msg.sender];
        uint256 len = lots.length;
        uint256 stop = maxLots < len - i ? i + maxLots : len;

        while (i < stop) {
            Lot memory lot = lots[i];
            if (block.timestamp < lot.unlockAt) break;
            amount += lot.amount;
            emit Claimed(msg.sender, i, lot.amount);
            unchecked {
                ++i;
            }
        }
        if (amount == 0) revert NothingToClaim();

        nextClaimIndex[msg.sender] = i;
        totalOwed -= amount;
        totalClaimed += amount;

        NEW_TOKEN.safeTransfer(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Permissionless housekeeping
    // ------------------------------------------------------------------

    /// @notice After END + grace, send the reserve that no lot is owed to TREASURY.
    /// @dev Anyone may call it, as often as they like. It never touches `totalOwed`,
    /// so every unclaimed lot stays fully backed and claimable forever.
    function sweep() external nonReentrant returns (uint256 amount) {
        if (block.timestamp < SWEEP_OPENS_AT) revert SweepNotOpen();
        amount = availableReserve();
        if (amount == 0) revert NothingToSweep();

        totalSwept += amount;
        emit Swept(TREASURY, amount);

        NEW_TOKEN.safeTransfer(TREASURY, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice New CT held here that no lot is owed to (what migrate can still hand out).
    function availableReserve() public view returns (uint256) {
        return NEW_TOKEN.balanceOf(address(this)) - totalOwed;
    }

    /// @notice True while `migrate` is accepted.
    function isOpen() external view returns (bool) {
        return block.timestamp >= START && block.timestamp < END;
    }

    /// @notice Number of lots the user has ever opened (claimed or not).
    function lotCount(address user) external view returns (uint256) {
        return _lots[user].length;
    }

    /// @notice One lot of `user`.
    function lotOf(address user, uint256 lotId)
        external
        view
        returns (uint256 amount, uint256 unlockAt, bool claimed)
    {
        Lot memory lot = _lots[user][lotId];
        return (lot.amount, lot.unlockAt, lotId < nextClaimIndex[user]);
    }

    /// @notice What `claim(maxLots)` would pay `user` right now, and how many lots.
    function claimable(address user, uint256 maxLots) external view returns (uint256 amount, uint256 lots) {
        Lot[] storage list = _lots[user];
        uint256 i = nextClaimIndex[user];
        uint256 len = list.length;
        uint256 stop = maxLots < len - i ? i + maxLots : len;
        while (i < stop && block.timestamp >= list[i].unlockAt) {
            amount += list[i].amount;
            unchecked {
                ++i;
                ++lots;
            }
        }
    }

    /// @notice New CT owed to `user` in lots that are not claimed yet (matured or not).
    /// @dev View only; loops over the unclaimed lots.
    function pendingOf(address user) external view returns (uint256 amount) {
        Lot[] storage list = _lots[user];
        for (uint256 i = nextClaimIndex[user]; i < list.length; ++i) {
            amount += list[i].amount;
        }
    }
}
