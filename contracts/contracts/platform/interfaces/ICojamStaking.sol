// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Cojam staking: external interface, events and errors
/// @notice What the PWA, the API, the indexer and the admin read and call on
/// `CojamStaking`. See `contracts/docs/CojamStaking.md` for the rules.
interface ICojamStaking {
    /// @notice One position as the views return it. `id` is its index in the owner's list.
    struct PositionView {
        uint256 id;
        uint256 principal;
        uint256 maxInterest;
        uint256 claimed;
        uint256 claimable;
        uint256 start;
        uint256 end;
        uint256 aprBps;
        uint256 lockIndex;
        bool closed;
    }

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// @notice A position was opened. `amount` is the principal that actually arrived.
    event Staked(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 lockDays,
        uint256 aprBps,
        uint256 end,
        uint256 maxInterest
    );
    /// @notice Interest was paid from an open position before its principal was withdrawn.
    event InterestClaimed(address indexed user, uint256 indexed id, uint256 amount);
    /// @notice A position was closed: its principal and all of its remaining interest were paid.
    event Withdrawn(address indexed user, uint256 indexed id, uint256 principal, uint256 interest);
    /// @notice The rate table for new positions changed (`rates[lockIndex][tier]`, basis points).
    event RatesSet(uint32[3][4] rates);
    /// @notice The tier thresholds for new positions changed.
    event TiersSet(uint256[2] thresholds);
    /// @notice The minimum stake (new positions) and the minimum locked claim changed.
    event MinimumsSet(uint256 minStake, uint256 minClaim);
    /// @notice The per user open position cap and the total principal cap changed (0 = no total cap).
    event CapsSet(uint256 maxOpenPositions, uint256 maxTotalPrincipal);
    /// @notice Reward CT not owed to anyone went back to the treasury.
    event RewardsWithdrawn(address indexed to, uint256 amount);
    /// @notice A new treasury was proposed; it can be applied from `eta`.
    event TreasuryProposed(address indexed treasury, uint256 eta);
    /// @notice A pending treasury proposal was dropped.
    event TreasuryProposalCancelled(address indexed treasury);
    /// @notice The treasury changed.
    event TreasurySet(address indexed previous, address indexed treasury);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error ZeroAddress();
    error DecimalsMismatch();
    error ZeroAmount();
    error InvalidLock(uint256 lockIndex);
    error BelowMinStake(uint256 amount, uint256 minStake);
    error TooManyPositions(uint256 open, uint256 max);
    error TotalCapReached(uint256 room, uint256 amount);
    error InsufficientRewards(uint256 available, uint256 needed);
    error NothingReceived();
    error ReceivedMoreThanSent();
    error UnknownPosition(uint256 id);
    error PositionClosed(uint256 id);
    error NothingToClaim();
    error BelowMinClaim(uint256 amount, uint256 minClaim);
    error LockNotEnded(uint256 end);
    error NotTreasury(address to);
    error RateOutOfBounds(uint256 lockIndex, uint256 tier, uint256 rateBps);
    error TiersOutOfBounds(uint256 low, uint256 high);
    error MinStakeOutOfBounds(uint256 minStake);
    error MinClaimOutOfBounds(uint256 minClaim);
    error MaxOpenPositionsOutOfBounds(uint256 maxOpenPositions);
    error NoTreasuryProposal();
    error TreasuryDelayNotPassed(uint256 eta);

    // ------------------------------------------------------------------
    // Holder actions
    // ------------------------------------------------------------------

    function stake(uint256 amount, uint8 lockIndex) external returns (uint256 id);

    function claimInterest(uint256 id) external returns (uint256 amount);

    function withdraw(uint256 id) external returns (uint256 principal, uint256 interest);

    // ------------------------------------------------------------------
    // Owner and pauser
    // ------------------------------------------------------------------

    function setRates(uint32[3][4] calldata newRates) external;

    function setTiers(uint256[2] calldata thresholds) external;

    function setMinimums(uint256 newMinStake, uint256 newMinClaim) external;

    function setCaps(uint256 newMaxOpenPositions, uint256 newMaxTotalPrincipal) external;

    function withdrawRewards(uint256 amount, address to) external;

    function proposeTreasury(address newTreasury) external;

    function cancelTreasury() external;

    function applyTreasury() external;

    function pause() external;

    function unpause() external;

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function availableRewards() external view returns (uint256);

    function claimable(address user, uint256 id) external view returns (uint256);

    function quote(uint256 amount, uint8 lockIndex)
        external
        view
        returns (uint256 tier, uint256 aprBps, uint256 interest, uint256 end);

    function positionsOf(address user, uint256 offset, uint256 limit)
        external
        view
        returns (PositionView[] memory page, uint256 total);

    function positionCount(address user) external view returns (uint256);

    function positionOf(address user, uint256 id) external view returns (PositionView memory);
}
