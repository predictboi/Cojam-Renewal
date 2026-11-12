// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CojamToken} from "./CojamToken.sol";

/// @title Cojam migration: old CT to new CT, 1:1, 10% at once and 90% after 7 days
/// @notice Holders call `migrate(amount)` after approving old CT. The contract
/// pulls the old CT and credits exactly what arrived. 10% of the credit (rounded
/// down) is sent in new CT at once; the rest becomes a lot that unlocks 7 days later.
/// A matured lot is released to its owner by `claim` (the owner) or by
/// `claimFor` / `claimForMany` (anyone, for example a keeper bot). Released tokens
/// always go to the lot owner, never to the caller.
///
/// There is no admin key. Every parameter is immutable. The window opens at deploy
/// and lasts 365 days. After the window and the grace period, anyone may call
/// `sweep()`, which sends only the reserve that no lot is owed to the immutable TREASURY.
///
/// Received old CT stays in this contract forever: no function can move it.
contract CojamMigration is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Length of the migration window, counted from deploy.
    uint256 public constant WINDOW = 365 days;
    /// @notice Each lot unlocks this long after its migrate call.
    uint256 public constant LOCK_PERIOD = 7 days;
    /// @notice Share of each credit paid at once, in percent (rounded down).
    uint256 public constant INSTANT_PERCENT = 10;
    /// @notice Upper bound for the grace period, to catch unit mistakes at deploy.
    uint256 public constant MAX_GRACE_PERIOD = 365 days;
    /// @notice Both tokens use 18 decimals, so 1 old base unit = 1 new base unit.
    uint8 public constant DECIMALS = 18;

    IERC20 public immutable OLD_TOKEN;
    IERC20 public immutable NEW_TOKEN;
    address public immutable TREASURY;
    uint256 public immutable WINDOW_START;
    uint256 public immutable WINDOW_END;
    uint256 public immutable SWEEP_OPENS_AT;

    /// @dev One storage slot. `amount` fits: the whole supply is below 2^92.
    struct Lot {
        uint128 amount;
        uint64 unlockAt;
    }

    mapping(address user => Lot[]) private _lots;
    /// @notice Lots with an id below this index are released. Because LOCK_PERIOD
    /// is constant and block time never decreases, a user's lots unlock in id order.
    mapping(address user => uint256) public nextClaimIndex;

    /// @notice Old CT credited through `migrate` (what actually arrived).
    uint256 public totalMigrated;
    /// @notice New CT paid at once by `migrate` (the 10% part).
    uint256 public totalInstant;
    /// @notice New CT owed to lots that are not released yet (the 90% part, outstanding).
    uint256 public totalOwed;
    /// @notice New CT released from lots.
    uint256 public totalClaimed;
    /// @notice New CT sent to TREASURY by `sweep`.
    uint256 public totalSwept;

    event Migrated(
        address indexed user,
        uint256 indexed lotId,
        uint256 oldAmount,
        uint256 instantAmount,
        uint256 lockedAmount,
        uint256 unlockAt
    );
    event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller);
    event Swept(address indexed to, uint256 amount);

    error ZeroAddress();
    error GracePeriodTooLong();
    error DecimalsMismatch();
    error SupplyMismatch();
    error ZeroAmount();
    error WindowClosed();
    error NothingReceived();
    error ReceivedMoreThanSent();
    error ReserveExhausted();
    error NothingToClaim();
    error SweepNotOpen();
    error NothingToSweep();

    /// @param oldToken    Old CT (Kaia mainnet 0x7f223b1607171b81ebd68d22f1ca79157fd4a44b).
    /// @param treasury    Receives the unowed reserve after WINDOW_END + gracePeriod
    ///                    (the new relaunch multisig).
    /// @param gracePeriod Seconds after WINDOW_END before `sweep` opens.
    constructor(IERC20 oldToken, address treasury, uint256 gracePeriod) {
        if (address(oldToken) == address(0) || treasury == address(0)) revert ZeroAddress();
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
        WINDOW_START = block.timestamp;
        WINDOW_END = block.timestamp + WINDOW;
        SWEEP_OPENS_AT = block.timestamp + WINDOW + gracePeriod;
    }

    // ------------------------------------------------------------------
    // Holder actions
    // ------------------------------------------------------------------

    /// @notice Swap `amount` old CT for the same amount of new CT: 10% now, 90% locked for 7 days.
    /// @dev Requires a prior `approve(this, amount)` on old CT (old CT has no permit).
    /// The pull happens before the state writes on purpose: the credit is the measured
    /// balance change, which only exists after the transfer. `nonReentrant` closes the
    /// window this ordering would otherwise open. The instant payout is the last step.
    /// @return lotId Index of the new lot in the caller's lot list.
    function migrate(uint256 amount) external nonReentrant returns (uint256 lotId) {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp >= WINDOW_END) revert WindowClosed();

        uint256 balanceBefore = OLD_TOKEN.balanceOf(address(this));
        OLD_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = OLD_TOKEN.balanceOf(address(this));

        if (balanceAfter <= balanceBefore) revert NothingReceived();
        uint256 received = balanceAfter - balanceBefore;
        if (received > amount) revert ReceivedMoreThanSent();

        // 1:1 with equal decimals: the credit in new CT equals `received`.
        if (received > availableReserve()) revert ReserveExhausted();
        uint256 instant = (received * INSTANT_PERCENT) / 100; // rounded down
        uint256 locked = received - instant; // always > 0, and instant + locked == received

        uint256 unlockAt = block.timestamp + LOCK_PERIOD;
        Lot[] storage lots = _lots[msg.sender];
        lotId = lots.length;
        lots.push(Lot({amount: SafeCast.toUint128(locked), unlockAt: SafeCast.toUint64(unlockAt)}));

        totalMigrated += received;
        totalInstant += instant;
        totalOwed += locked;

        emit Migrated(msg.sender, lotId, received, instant, locked, unlockAt);

        if (instant > 0) NEW_TOKEN.safeTransfer(msg.sender, instant);
    }

    /// @notice Release the caller's matured lots, oldest first, at most `maxLots` of them.
    /// @return amount New CT sent to the caller.
    function claim(uint256 maxLots) external nonReentrant returns (uint256 amount) {
        amount = _release(msg.sender, maxLots);
        if (amount == 0) revert NothingToClaim();
        NEW_TOKEN.safeTransfer(msg.sender, amount);
    }

    /// @notice Release `user`'s matured lots to `user`. Anyone may call it (for example
    /// a keeper bot paying the gas). The tokens always go to `user`, never to the caller.
    /// @return amount New CT sent to `user`.
    function claimFor(address user, uint256 maxLots) external nonReentrant returns (uint256 amount) {
        amount = _release(user, maxLots);
        if (amount == 0) revert NothingToClaim();
        NEW_TOKEN.safeTransfer(user, amount);
    }

    /// @notice Batch form of `claimFor` for keepers. Users with nothing matured are
    /// skipped instead of reverting the batch. Each user is paid only their own lots.
    /// @return total New CT released across all users.
    function claimForMany(address[] calldata users, uint256 maxLotsEach)
        external
        nonReentrant
        returns (uint256 total)
    {
        for (uint256 k = 0; k < users.length; ++k) {
            address user = users[k];
            uint256 amount = _release(user, maxLotsEach);
            if (amount > 0) {
                total += amount;
                NEW_TOKEN.safeTransfer(user, amount);
            }
        }
        if (total == 0) revert NothingToClaim();
    }

    /// @dev Marks up to `maxLots` matured lots of `user` as released and returns their sum.
    /// Bounded by `maxLots`, so a wallet with very many lots is always releasable in
    /// several transactions. Stops at the first lot that is still locked.
    function _release(address user, uint256 maxLots) private returns (uint256 amount) {
        Lot[] storage lots = _lots[user];
        uint256 i = nextClaimIndex[user];
        uint256 len = lots.length;
        uint256 stop = maxLots < len - i ? i + maxLots : len;

        while (i < stop) {
            Lot memory lot = lots[i];
            if (block.timestamp < lot.unlockAt) break;
            amount += lot.amount;
            emit Claimed(user, i, lot.amount, msg.sender);
            unchecked {
                ++i;
            }
        }
        if (amount > 0) {
            nextClaimIndex[user] = i;
            totalOwed -= amount;
            totalClaimed += amount;
        }
    }

    // ------------------------------------------------------------------
    // Permissionless housekeeping
    // ------------------------------------------------------------------

    /// @notice After WINDOW_END + grace, send the reserve that no lot is owed to TREASURY.
    /// @dev Anyone may call it, as often as they like. It never touches `totalOwed`,
    /// so every locked remainder stays fully backed and releasable forever.
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
        return block.timestamp < WINDOW_END;
    }

    /// @notice Split of a credit of `received` old CT: (instant now, locked for 7 days).
    function previewSplit(uint256 received) external pure returns (uint256 instant, uint256 locked) {
        instant = (received * INSTANT_PERCENT) / 100;
        locked = received - instant;
    }

    /// @notice Number of lots the user has ever opened (released or not).
    function lotCount(address user) external view returns (uint256) {
        return _lots[user].length;
    }

    /// @notice One lot of `user` (its locked 90% part).
    function lotOf(address user, uint256 lotId)
        external
        view
        returns (uint256 amount, uint256 unlockAt, bool claimed)
    {
        Lot memory lot = _lots[user][lotId];
        return (lot.amount, lot.unlockAt, lotId < nextClaimIndex[user]);
    }

    /// @notice What a claim with `maxLots` would release to `user` right now, and how many lots.
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

    /// @notice New CT still locked or awaiting release for `user` (matured or not).
    /// @dev View only; loops over the unreleased lots.
    function pendingOf(address user) external view returns (uint256 amount) {
        Lot[] storage list = _lots[user];
        for (uint256 i = nextClaimIndex[user]; i < list.length; ++i) {
            amount += list[i].amount;
        }
    }
}
