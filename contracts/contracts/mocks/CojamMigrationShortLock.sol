// SPDX-License-Identifier: MIT
// TEST ONLY. Generated from CojamMigration.sol with LOCK_PERIOD = 1 minutes, for live release tests on Kairos.
// Never deploy to mainnet. Regenerate after any change to CojamMigration.sol (see scripts/shortlock-kairos.js).
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Cojam migration: old CT to new CT, 1:1, 10% at once and 90% after 7 days
/// @notice Holders call `migrate(amount)` after approving old CT. The contract
/// pulls the old CT and credits exactly what arrived. 10% of the credit (rounded
/// down) is sent in new CT at once; the rest becomes a lot that unlocks 7 days later.
/// A matured lot is released to its owner by `claim` (the owner) or by
/// `claimFor` / `claimForMany` (anyone, for example a keeper bot). Released tokens
/// always go to the lot owner, never to the caller.
///
/// Funding: the new token is deployed on its own and its whole supply goes to the
/// project's MASTER wallet. The master funds this contract with plain transfers of
/// new CT. `migrate` only hands out the reserve, which is the new CT held here minus
/// `totalOwed` (what earlier lots are still owed).
///
/// No owner, no pause, no setter, no upgrade. The one privileged call is
/// `withdraw(amount)`: only MASTER may call it, at any time, and it sends at most
/// `availableReserve()` back to MASTER. New CT owed to lots can never be withdrawn.
///
/// Received old CT stays in this contract forever: no function can move it.
/// Any other token sent here by mistake (anything but new CT) is stuck forever too.
contract CojamMigrationShortLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Length of the migration window, counted from deploy.
    uint256 public constant WINDOW = 365 days;
    /// @notice Each lot unlocks this long after its migrate call.
    uint256 public constant LOCK_PERIOD = 1 minutes;
    /// @notice Share of each credit paid at once, in percent (rounded down).
    uint256 public constant INSTANT_PERCENT = 10;
    /// @notice Both tokens use 18 decimals, so 1 old base unit = 1 new base unit.
    uint8 public constant DECIMALS = 18;
    /// @notice Owner of the old CT contract, unrelated to the relaunch. Refused as MASTER.
    address public constant OLD_CT_OWNER = 0xEB1622d0377da1F9815bFC6efF61afE3257a0518;

    IERC20 public immutable OLD_TOKEN;
    IERC20 public immutable NEW_TOKEN;
    /// @notice Funds the swap by plain transfers; the only address that may `withdraw`.
    address public immutable MASTER;
    uint256 public immutable WINDOW_START;
    uint256 public immutable WINDOW_END;

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
    /// @notice New CT sent back to MASTER by `withdraw`.
    uint256 public totalWithdrawn;

    event Migrated(
        address indexed user,
        uint256 indexed lotId,
        uint256 oldAmount,
        uint256 instantAmount,
        uint256 lockedAmount,
        uint256 unlockAt
    );
    event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller);
    event Withdrawn(uint256 amount);

    error ZeroAddress();
    error OldOwnerNotAllowed();
    error SameToken();
    error DecimalsMismatch();
    error SupplyMismatch();
    error ZeroAmount();
    error WindowClosed();
    error InsufficientReserve(uint256 available, uint256 needed);
    error NothingReceived();
    error ReceivedMoreThanSent();
    error NothingToClaim();
    error NotMaster();

    /// @param oldToken Old CT (Kaia mainnet 0x7f223b1607171b81ebd68d22f1ca79157fd4a44b).
    /// @param newToken New CT (`CojamToken`), deployed before this contract.
    /// @param master   The master wallet: funds this contract and may withdraw the reserve.
    constructor(IERC20 oldToken, IERC20 newToken, address master) {
        if (address(oldToken) == address(0) || address(newToken) == address(0) || master == address(0)) {
            revert ZeroAddress();
        }
        if (master == OLD_CT_OWNER) revert OldOwnerNotAllowed();
        if (address(oldToken) == address(newToken)) revert SameToken();
        if (IERC20Metadata(address(oldToken)).decimals() != DECIMALS) revert DecimalsMismatch();
        if (IERC20Metadata(address(newToken)).decimals() != DECIMALS) revert DecimalsMismatch();
        // The new supply must be able to cover every old token still in existence.
        // (Old CT can only shrink: it has burn and no mint.)
        if (newToken.totalSupply() < oldToken.totalSupply()) revert SupplyMismatch();

        OLD_TOKEN = oldToken;
        NEW_TOKEN = newToken;
        MASTER = master;
        WINDOW_START = block.timestamp;
        WINDOW_END = block.timestamp + WINDOW;
    }

    // ------------------------------------------------------------------
    // Holder actions
    // ------------------------------------------------------------------

    /// @notice Swap `amount` old CT for the same amount of new CT: 10% now, 90% locked for 7 days.
    /// @dev Requires a prior `approve(this, amount)` on old CT (old CT has no permit).
    /// The reserve is checked against `amount` before the pull; the credit is at most
    /// `amount`, so a swap can never use new CT owed to earlier lots.
    /// The pull happens before the state writes on purpose: the credit is the measured
    /// balance change, which only exists after the transfer. `nonReentrant` closes the
    /// window this ordering would otherwise open. The instant payout is the last step.
    /// @return lotId Index of the new lot in the caller's lot list.
    function migrate(uint256 amount) external nonReentrant returns (uint256 lotId) {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp >= WINDOW_END) revert WindowClosed();
        uint256 available = availableReserve();
        if (available < amount) revert InsufficientReserve(available, amount);

        uint256 balanceBefore = OLD_TOKEN.balanceOf(address(this));
        OLD_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = OLD_TOKEN.balanceOf(address(this));

        if (balanceAfter <= balanceBefore) revert NothingReceived();
        uint256 received = balanceAfter - balanceBefore;
        if (received > amount) revert ReceivedMoreThanSent();

        // 1:1 with equal decimals: the credit in new CT equals `received` (<= amount <= available).
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
    // Master
    // ------------------------------------------------------------------

    /// @notice Send `amount` reserve new CT back to MASTER. Only MASTER may call it, at
    /// any time (inside or after the window). Capped at `availableReserve()`, so new CT
    /// owed to lots can never be withdrawn and every lot stays fully backed.
    function withdraw(uint256 amount) external nonReentrant {
        if (msg.sender != MASTER) revert NotMaster();
        if (amount == 0) revert ZeroAmount();
        uint256 available = availableReserve();
        if (amount > available) revert InsufficientReserve(available, amount);

        totalWithdrawn += amount;
        emit Withdrawn(amount);

        NEW_TOKEN.safeTransfer(MASTER, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice New CT held here that no lot is owed to (what migrate can still hand
    /// out, and what MASTER may `withdraw`).
    function availableReserve() public view returns (uint256) {
        return NEW_TOKEN.balanceOf(address(this)) - totalOwed;
    }

    /// @notice True inside the window. (It does not check the reserve; see `availableReserve`.)
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
