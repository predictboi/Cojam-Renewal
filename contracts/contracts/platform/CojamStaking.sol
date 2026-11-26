// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControlDefaultAdminRules} from
    "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {ICojamStaking} from "./interfaces/ICojamStaking.sol";

/// @title Cojam staking: fixed term CT positions with interest reserved in full at stake time
/// @notice A holder stakes CT for 30, 90, 180 or 365 days. The annual rate comes from a
/// table indexed by the lock and by the tier of the position's own amount (under 1,000 CT,
/// 1,000 to 9,999 CT, 10,000 CT and more) and is copied into the position when it opens.
/// Interest is simple and accrues per second from `start` to `end`, then stops. Interest can
/// be claimed while locked (at least `minClaim` at a time) and in any amount after the lock;
/// `withdraw` after the lock pays the principal plus all remaining interest. There is no
/// early exit.
///
/// Solvency: when a position opens, its whole interest for the lock (`maxInterest`) is
/// reserved out of the reward CT the contract holds. The contract therefore never promises
/// interest it does not hold: `CT.balanceOf(this) >= totalPrincipal + totalCommitted`.
/// Reward CT is funded by plain transfers from the master wallet. Only CT above
/// `totalPrincipal + totalCommitted` (`availableRewards()`) can leave through the owner,
/// and only to the treasury.
///
/// Roles: the owner (`DEFAULT_ADMIN_ROLE`, 3 day transfer delay) sets the rate table, the
/// tiers, the minimums and the caps (bounded, new positions only), withdraws unused rewards
/// to the treasury, changes the treasury after 48 hours and unpauses. `PAUSER_ROLE` pauses
/// `stake` only: claims and withdrawals have no pause.
///
/// Immutable: no proxy, no upgrade. Tokens other than CT sent here are stuck forever.
/// Staking functions read `msg.sender` only, so no relayer or play key can act for a holder.
contract CojamStaking is ICojamStaking, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    /// @notice May call `pause`. Held by the operator key and the master wallet.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Delay of an owner role transfer (`AccessControlDefaultAdminRules`).
    uint48 public constant ADMIN_TRANSFER_DELAY = 3 days;
    /// @notice Delay between `proposeTreasury` and `applyTreasury`.
    uint256 public constant TREASURY_DELAY = 48 hours;
    /// @notice Interest year: 365 days of seconds.
    uint256 public constant YEAR = 365 days;
    /// @notice Basis points in one whole.
    uint256 public constant BPS = 10_000;
    /// @notice Number of lock periods (30, 90, 180, 365 days).
    uint256 public constant LOCK_COUNT = 4;
    /// @notice Number of amount tiers.
    uint256 public constant TIER_COUNT = 3;
    /// @notice Highest rate the owner may set, in basis points (50% a year).
    uint256 public constant MAX_RATE_BPS = 5_000;
    /// @notice Bounds of `minStake`: 1 to 100,000 CT.
    uint256 public constant MIN_STAKE_FLOOR = 1e18;
    uint256 public constant MIN_STAKE_CEILING = 100_000e18;
    /// @notice Upper bound of `minClaim` (lower bound 0): 1,000 CT.
    uint256 public constant MIN_CLAIM_CEILING = 1_000e18;
    /// @notice Upper bound of `maxOpenPositions` (lower bound 1). The decided limit is 20.
    uint256 public constant MAX_OPEN_POSITIONS_CEILING = 20;
    /// @notice Upper bound of the high tier threshold: 100,000,000 CT.
    uint256 public constant TIER_CEILING = 100_000_000e18;

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    /// @notice Cojam Token (Kaia mainnet 0x91cb3B346C80ff965a9667ba6228834dbedD71a2).
    IERC20 public immutable CT;

    /// @dev Two storage slots. Slot 1: principal, maxInterest. Slot 2: claimed (128),
    /// start (40), end (40), aprBps (32), lockIndex (8), closed (8). 40 bit timestamps last
    /// for about 34,000 years; all amounts are bounded by the CT supply (below 2^91).
    struct Position {
        uint128 principal;
        uint128 maxInterest; // interest reserved at stake time for the full lock
        uint128 claimed; // interest paid so far
        uint40 start;
        uint40 end; // start + lock duration
        uint32 aprBps; // snapshot of the rate at stake time
        uint8 lockIndex;
        bool closed; // principal withdrawn
    }

    mapping(address user => Position[]) private _positions;

    /// @notice Positions of `user` whose principal is not withdrawn yet.
    mapping(address user => uint256) public openPositions;
    /// @notice Principal of `user`'s open positions, summed (what `maxUserPrincipal` caps).
    mapping(address user => uint256) public principalOf;
    /// @notice CT owed back to stakers as principal.
    uint256 public totalPrincipal;
    /// @notice Interest reserved for open positions and not paid yet: sum of (maxInterest - claimed).
    uint256 public totalCommitted;
    /// @notice Interest paid so far, by claims and withdrawals.
    uint256 public totalInterestPaid;
    /// @notice Reward CT sent back to the treasury.
    uint256 public totalRewardsWithdrawn;

    /// @notice Lower bounds of tier 1 and tier 2: an amount below `tierThresholds[0]` is
    /// tier 0, below `tierThresholds[1]` tier 1, otherwise tier 2.
    uint256[2] public tierThresholds;
    /// @notice Annual rate in basis points, `rateBps[lockIndex][tier]`.
    uint32[3][4] public rateBps;
    /// @notice Smallest principal of a new position.
    uint256 public minStake;
    /// @notice Smallest interest claim while the lock runs (none after the lock).
    uint256 public minClaim;
    /// @notice Most open positions one address may hold.
    uint256 public maxOpenPositions;
    /// @notice Cap on `totalPrincipal` checked by `stake`; 0 means no cap.
    uint256 public maxTotalPrincipal;
    /// @notice Cap on `principalOf[user]` checked by `stake`; 0 means no cap.
    uint256 public maxUserPrincipal;

    /// @notice Where `withdrawRewards` may send CT.
    address public treasury;
    /// @notice Proposed treasury and when it can be applied (0 when none is pending).
    address public pendingTreasury;
    uint256 public pendingTreasuryEta;

    /// @param ct            CT (18 decimals, plain ERC-20).
    /// @param owner_        The owner (`DEFAULT_ADMIN_ROLE`), also granted `PAUSER_ROLE`.
    /// @param treasury_     Receiver of `withdrawRewards`.
    /// @param pauser        An extra `PAUSER_ROLE` holder (the operator key); zero for none.
    constructor(IERC20 ct, address owner_, address treasury_, address pauser)
        AccessControlDefaultAdminRules(ADMIN_TRANSFER_DELAY, owner_)
    {
        if (address(ct) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (IERC20Metadata(address(ct)).decimals() != 18) revert DecimalsMismatch();
        CT = ct;
        treasury = treasury_;

        _grantRole(PAUSER_ROLE, owner_);
        if (pauser != address(0)) _grantRole(PAUSER_ROLE, pauser);

        // Plan defaults (PLAN-SOURCE, DEV-PLAN 3.5).
        tierThresholds = [uint256(1_000e18), 10_000e18];
        rateBps = [
            [uint32(800), 900, 1000], // 30 days
            [uint32(1200), 1300, 1400], // 90 days
            [uint32(1800), 1900, 2000], // 180 days
            [uint32(2500), 2600, 2700] // 365 days
        ];
        minStake = 100e18;
        minClaim = 10e18;
        maxOpenPositions = 20;
        maxUserPrincipal = 1_000_000e18; // DECISIONS "Staking cap per user"

        emit RatesSet(rateBps);
        emit TiersSet(tierThresholds);
        emit MinimumsSet(minStake, minClaim);
        emit CapsSet(maxOpenPositions, 0, maxUserPrincipal);
        emit TreasurySet(address(0), treasury_);
    }

    // ------------------------------------------------------------------
    // Holder actions
    // ------------------------------------------------------------------

    /// @notice Open a position of `amount` CT locked for `lockDays(lockIndex)` days.
    /// @dev Requires a prior `approve(this, amount)` on CT (CT has no permit). The pull
    /// comes before the state writes on purpose: the principal is the measured balance
    /// change, and the tier, the total cap and the reserve check all use it. `nonReentrant`
    /// closes the window this ordering opens. The whole interest of the lock is reserved
    /// from `availableRewards()`; when that is short the call reverts with
    /// `InsufficientRewards(available, needed)` and nothing changes.
    /// @return id Index of the new position in the caller's list.
    function stake(uint256 amount, uint8 lockIndex) external nonReentrant whenNotPaused returns (uint256 id) {
        if (lockIndex >= LOCK_COUNT) revert InvalidLock(lockIndex);
        uint256 min = minStake;
        if (amount < min) revert BelowMinStake(amount, min);
        uint256 open = openPositions[msg.sender];
        if (open >= maxOpenPositions) revert TooManyPositions(open, maxOpenPositions);

        uint256 received = _pull(amount);
        if (received < min) revert BelowMinStake(received, min);

        uint256 cap = maxTotalPrincipal;
        if (cap != 0 && totalPrincipal + received > cap) {
            revert TotalCapReached(cap > totalPrincipal ? cap - totalPrincipal : 0, received);
        }
        uint256 userCap = maxUserPrincipal;
        uint256 mine = principalOf[msg.sender];
        if (userCap != 0 && mine + received > userCap) {
            revert UserCapReached(userCap > mine ? userCap - mine : 0, received);
        }
        principalOf[msg.sender] = mine + received;

        id = _open(received, lockIndex);
        openPositions[msg.sender] = open + 1;
    }

    /// @dev Pulls `amount` CT from the caller and returns what actually arrived.
    function _pull(uint256 amount) private returns (uint256 received) {
        uint256 balanceBefore = CT.balanceOf(address(this));
        CT.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = CT.balanceOf(address(this));
        if (balanceAfter <= balanceBefore) revert NothingReceived();
        received = balanceAfter - balanceBefore;
        if (received > amount) revert ReceivedMoreThanSent();
    }

    /// @dev Reserves the interest and records the position for `received` CT of principal
    /// that already sits in this contract.
    function _open(uint256 received, uint8 lockIndex) private returns (uint256 id) {
        uint256 duration = _lockDuration(lockIndex);
        uint256 apr = rateBps[lockIndex][_tierOf(received)];
        uint256 interest = (received * apr * duration) / (BPS * YEAR);

        // The principal is counted first, so it is not mistaken for reward CT.
        totalPrincipal += received;
        uint256 available = availableRewards();
        if (available < interest) revert InsufficientRewards(available, interest);
        totalCommitted += interest;

        uint256 end = block.timestamp + duration;
        Position[] storage list = _positions[msg.sender];
        id = list.length;
        list.push(
            Position({
                principal: SafeCast.toUint128(received),
                maxInterest: SafeCast.toUint128(interest),
                claimed: 0,
                start: SafeCast.toUint40(block.timestamp),
                end: SafeCast.toUint40(end),
                aprBps: SafeCast.toUint32(apr),
                lockIndex: lockIndex,
                closed: false
            })
        );

        emit Staked(msg.sender, id, received, lockDays(lockIndex), apr, end, interest);
    }

    /// @notice Pay the interest position `id` has earned so far and not been paid.
    /// While the lock runs the payout must be at least `minClaim`; after the lock any
    /// amount above zero is paid. Never paused.
    /// @return amount CT sent to the caller.
    function claimInterest(uint256 id) external nonReentrant returns (uint256 amount) {
        Position storage p = _openPosition(msg.sender, id);
        amount = _earned(p, block.timestamp) - p.claimed;
        if (amount == 0) revert NothingToClaim();
        if (block.timestamp < p.end && amount < minClaim) revert BelowMinClaim(amount, minClaim);

        p.claimed += SafeCast.toUint128(amount);
        totalCommitted -= amount;
        totalInterestPaid += amount;
        emit InterestClaimed(msg.sender, id, amount);

        CT.safeTransfer(msg.sender, amount);
    }

    /// @notice Close position `id` once its lock has ended: pays the principal plus all
    /// interest not claimed yet. Never paused.
    /// @return principal The principal paid back.
    /// @return interest  The interest paid with it.
    function withdraw(uint256 id) external nonReentrant returns (uint256 principal, uint256 interest) {
        Position storage p = _openPosition(msg.sender, id);
        if (block.timestamp < p.end) revert LockNotEnded(p.end);

        principal = p.principal;
        // earned(end) == maxInterest by construction (same formula), so this releases the
        // whole reservation and leaves no rounding dust in totalCommitted.
        interest = uint256(p.maxInterest) - p.claimed;

        p.closed = true;
        p.claimed = p.maxInterest;
        openPositions[msg.sender] -= 1;
        principalOf[msg.sender] -= principal;
        totalPrincipal -= principal;
        totalCommitted -= interest;
        totalInterestPaid += interest;
        emit Withdrawn(msg.sender, id, principal, interest);

        CT.safeTransfer(msg.sender, principal + interest);
    }

    // ------------------------------------------------------------------
    // Owner
    // ------------------------------------------------------------------

    /// @notice Replace the rate table for new positions (`newRates[lockIndex][tier]`, basis
    /// points, each at most `MAX_RATE_BPS`). Open positions keep their snapshot.
    function setRates(uint32[3][4] calldata newRates) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < LOCK_COUNT; ++i) {
            for (uint256 j = 0; j < TIER_COUNT; ++j) {
                if (newRates[i][j] > MAX_RATE_BPS) revert RateOutOfBounds(i, j, newRates[i][j]);
            }
        }
        rateBps = newRates;
        emit RatesSet(newRates);
    }

    /// @notice Replace the tier thresholds for new positions: `0 < low < high <= TIER_CEILING`.
    function setTiers(uint256[2] calldata thresholds) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (thresholds[0] == 0 || thresholds[0] >= thresholds[1] || thresholds[1] > TIER_CEILING) {
            revert TiersOutOfBounds(thresholds[0], thresholds[1]);
        }
        tierThresholds = thresholds;
        emit TiersSet(thresholds);
    }

    /// @notice Set the minimum stake (1 to 100,000 CT, new positions) and the minimum
    /// claim while locked (0 to 1,000 CT). `minClaim` is read at claim time, so a change
    /// can move when an open position may claim before its end, never how much it earns:
    /// after the lock every remaining unit is claimable and `withdraw` pays it all.
    function setMinimums(uint256 newMinStake, uint256 newMinClaim) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMinStake < MIN_STAKE_FLOOR || newMinStake > MIN_STAKE_CEILING) revert MinStakeOutOfBounds(newMinStake);
        if (newMinClaim > MIN_CLAIM_CEILING) revert MinClaimOutOfBounds(newMinClaim);
        minStake = newMinStake;
        minClaim = newMinClaim;
        emit MinimumsSet(newMinStake, newMinClaim);
    }

    /// @notice Set the per user open position cap (1 to 20), the cap on total principal and
    /// the cap on one address's open principal (0 for none on either). All are checked only
    /// by `stake`; a cap below the current figure just stops new positions (for the user cap,
    /// only that user's).
    function setCaps(uint256 newMaxOpenPositions, uint256 newMaxTotalPrincipal, uint256 newMaxUserPrincipal)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newMaxOpenPositions == 0 || newMaxOpenPositions > MAX_OPEN_POSITIONS_CEILING) {
            revert MaxOpenPositionsOutOfBounds(newMaxOpenPositions);
        }
        maxOpenPositions = newMaxOpenPositions;
        maxTotalPrincipal = newMaxTotalPrincipal;
        maxUserPrincipal = newMaxUserPrincipal;
        emit CapsSet(newMaxOpenPositions, newMaxTotalPrincipal, newMaxUserPrincipal);
    }

    /// @notice Send `amount` reward CT that no position is owed back to the treasury.
    /// Capped at `availableRewards()`, so principal and committed interest can never leave.
    /// @param to Must equal `treasury` (passed explicitly so a signer sees the destination).
    function withdrawRewards(uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (to != treasury) revert NotTreasury(to);
        if (amount == 0) revert ZeroAmount();
        uint256 available = availableRewards();
        if (amount > available) revert InsufficientRewards(available, amount);

        totalRewardsWithdrawn += amount;
        emit RewardsWithdrawn(to, amount);

        CT.safeTransfer(to, amount);
    }

    /// @notice Propose a new treasury; `applyTreasury` can set it after `TREASURY_DELAY`.
    /// A new proposal replaces a pending one and restarts the delay.
    function proposeTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        uint256 eta = block.timestamp + TREASURY_DELAY;
        pendingTreasury = newTreasury;
        pendingTreasuryEta = eta;
        emit TreasuryProposed(newTreasury, eta);
    }

    /// @notice Drop the pending treasury proposal.
    function cancelTreasury() external onlyRole(DEFAULT_ADMIN_ROLE) {
        address pending = pendingTreasury;
        if (pending == address(0)) revert NoTreasuryProposal();
        delete pendingTreasury;
        delete pendingTreasuryEta;
        emit TreasuryProposalCancelled(pending);
    }

    /// @notice Set the pending treasury once its delay has passed.
    function applyTreasury() external onlyRole(DEFAULT_ADMIN_ROLE) {
        address pending = pendingTreasury;
        if (pending == address(0)) revert NoTreasuryProposal();
        if (block.timestamp < pendingTreasuryEta) revert TreasuryDelayNotPassed(pendingTreasuryEta);
        address previous = treasury;
        treasury = pending;
        delete pendingTreasury;
        delete pendingTreasuryEta;
        emit TreasurySet(previous, pending);
    }

    /// @notice Stop new positions. Claims and withdrawals are not affected.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Allow new positions again. Owner only.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Reward CT held here beyond every principal and every reserved interest:
    /// what new positions can reserve and what the owner can withdraw. Returns 0 if the
    /// balance were ever below the obligations (impossible with a plain ERC-20).
    function availableRewards() public view returns (uint256) {
        uint256 balance = CT.balanceOf(address(this));
        uint256 owed = totalPrincipal + totalCommitted;
        return balance > owed ? balance - owed : 0;
    }

    /// @notice Interest position `id` of `user` has earned and not been paid (0 once closed).
    function claimable(address user, uint256 id) external view returns (uint256) {
        Position storage p = _position(user, id);
        if (p.closed) return 0;
        return _earned(p, block.timestamp) - p.claimed;
    }

    /// @notice What `stake(amount, lockIndex)` would open now if `amount` arrived in full:
    /// the tier, the rate, the interest for the whole lock and the end time. It does not
    /// check the minimum, the caps or the reward reserve.
    function quote(uint256 amount, uint8 lockIndex)
        external
        view
        returns (uint256 tier, uint256 aprBps, uint256 interest, uint256 end)
    {
        if (lockIndex >= LOCK_COUNT) revert InvalidLock(lockIndex);
        uint256 duration = _lockDuration(lockIndex);
        tier = _tierOf(amount);
        aprBps = rateBps[lockIndex][tier];
        interest = (amount * aprBps * duration) / (BPS * YEAR);
        end = block.timestamp + duration;
    }

    /// @notice Tier of a position of `amount` CT under the current thresholds (0, 1 or 2).
    function tierOf(uint256 amount) external view returns (uint256) {
        return _tierOf(amount);
    }

    /// @notice Lock length in days for `lockIndex` (30, 90, 180, 365).
    function lockDays(uint256 lockIndex) public pure returns (uint256) {
        if (lockIndex == 0) return 30;
        if (lockIndex == 1) return 90;
        if (lockIndex == 2) return 180;
        if (lockIndex == 3) return 365;
        revert InvalidLock(lockIndex);
    }

    /// @notice Lock length in seconds for `lockIndex`.
    function lockDuration(uint256 lockIndex) external view returns (uint256) {
        if (lockIndex >= LOCK_COUNT) revert InvalidLock(lockIndex);
        return _lockDuration(lockIndex);
    }

    /// @notice The whole rate table, `[lockIndex][tier]` in basis points.
    function rates() external view returns (uint32[3][4] memory) {
        return rateBps;
    }

    /// @notice Number of positions `user` has ever opened (open or closed).
    function positionCount(address user) external view returns (uint256) {
        return _positions[user].length;
    }

    /// @notice One position of `user`, with its claimable interest now.
    function positionOf(address user, uint256 id) external view returns (PositionView memory) {
        return _view(_position(user, id), id);
    }

    /// @notice Up to `limit` positions of `user` starting at id `offset`, oldest first,
    /// and the total count. An offset at or past the end returns an empty page.
    function positionsOf(address user, uint256 offset, uint256 limit)
        external
        view
        returns (PositionView[] memory page, uint256 total)
    {
        Position[] storage list = _positions[user];
        total = list.length;
        if (offset >= total) return (new PositionView[](0), total);
        uint256 count = total - offset;
        if (limit < count) count = limit;
        page = new PositionView[](count);
        for (uint256 k = 0; k < count; ++k) {
            page[k] = _view(list[offset + k], offset + k);
        }
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev Lock length in seconds. Virtual only so a test build can use short locks
    /// (`mocks/StakingShortLock.sol`); this contract is never deployed with an override.
    function _lockDuration(uint256 lockIndex) internal view virtual returns (uint256) {
        return lockDays(lockIndex) * 1 days;
    }

    function _tierOf(uint256 amount) private view returns (uint256) {
        if (amount < tierThresholds[0]) return 0;
        if (amount < tierThresholds[1]) return 1;
        return 2;
    }

    /// @dev Interest earned from `start` to `min(t, end)`, rounded down. Always computed
    /// from `start`, so repeated claims cannot drift; at `end` it equals `maxInterest`.
    function _earned(Position storage p, uint256 t) private view returns (uint256) {
        uint256 until = t < p.end ? t : p.end;
        return (uint256(p.principal) * p.aprBps * (until - p.start)) / (BPS * YEAR);
    }

    function _position(address user, uint256 id) private view returns (Position storage) {
        Position[] storage list = _positions[user];
        if (id >= list.length) revert UnknownPosition(id);
        return list[id];
    }

    function _openPosition(address user, uint256 id) private view returns (Position storage p) {
        p = _position(user, id);
        if (p.closed) revert PositionClosed(id);
    }

    function _view(Position storage p, uint256 id) private view returns (PositionView memory v) {
        v.id = id;
        v.principal = p.principal;
        v.maxInterest = p.maxInterest;
        v.claimed = p.claimed;
        v.claimable = p.closed ? 0 : _earned(p, block.timestamp) - p.claimed;
        v.start = p.start;
        v.end = p.end;
        v.aprBps = p.aprBps;
        v.lockIndex = p.lockIndex;
        v.closed = p.closed;
    }
}
