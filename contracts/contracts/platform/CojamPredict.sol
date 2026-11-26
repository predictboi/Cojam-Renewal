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
import {Params, MarketInput, Market, UserDay, Player, PlayKey, ReferralStats, WeekScore} from "./PredictTypes.sol";
import {PredictLogic} from "./PredictLogic.sol";

/// @title Cojam Daily Prediction: point ledger, daily markets, predictions, conversion and weekly airdrop
/// @notice Every day (UTC, so 09:00 KST / JST) the operator publishes 5 point markets. A registered
/// player answers each one with one transaction (`predict`), sent by the player's wallet or by the
/// player's play key, a device key that can only predict. The fifth answer of a day credits the
/// completion points at once. Hit points are credited lazily per market by `settle`, which anyone may
/// call once the market's settle time (resolution plus the correction window) has passed.
///
/// Points ("Cojam Points", CJP, 0 decimals) are an ERC-20 shaped but soulbound ledger kept in this
/// contract: they are created only by completions, hits, compensations and the invite and welcome
/// bonuses, and destroyed only by `convert`, which pays CT from this contract's reserve. Transfers and
/// approvals always revert.
///
/// The CT reserve is funded by plain CT transfers from the master wallet. It pays conversions and the
/// weekly airdrop; the owner may take unused CT back, but only to the treasury.
///
/// Roles: the owner (`DEFAULT_ADMIN_ROLE`, 3 day transfer delay) proposes parameters (applied after
/// 48 hours), unpauses, records corrected outcomes and withdraws the reserve to the treasury. The
/// OPERATOR registers players, links inviters, freezes and unfreezes, creates days, sets and corrects
/// outcomes inside the window, voids, compensates and airdrops: every one of these is rule checked on
/// chain. The PAUSER stops new predictions and conversions only. No proxy, no upgrade.
///
/// Deployment links the stateless library `PredictLogic` (parameter bounds, day creation, airdrop
/// checks, one view), which keeps this contract under the code size limit. Structs live in
/// `PredictTypes.sol`.
contract CojamPredict is AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    /// @notice Role that runs the daily operations (hot key in the worker).
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @notice Role that may pause new predictions and conversions (not unpause).
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice After registration, `setReferrer` may link an inviter only during this window.
    uint64 public constant INVITE_WINDOW = 24 hours;
    /// @notice Longest lifetime of a play key binding.
    uint64 public constant MAX_PLAY_KEY_TTL = 90 days;
    /// @notice Every market is resolved (or voidable by anyone) within this time after its day's end.
    uint64 public constant RESOLVE_DEADLINE = 48 hours;
    /// @notice Wait between `proposeParams` and `applyParams`.
    uint64 public constant PARAM_DELAY = 48 hours;
    /// @notice Delay of an owner (default admin) transfer.
    uint48 public constant ADMIN_TRANSFER_DELAY = 3 days;
    /// @notice Largest batch for `registerPlayers`, `setReferrers`, `setFrozenMany` and `settleMany`.
    uint256 public constant MAX_BATCH = 200;
    /// @notice Largest batch for `compensate`.
    uint256 public constant MAX_COMPENSATE_BATCH = 500;
    /// @notice Number of paid ranks in the weekly airdrop.
    uint256 public constant MAX_WINNERS = 10;
    /// @notice Markets per day.
    uint256 public constant SLOTS = 5;

    /// @notice Outcome codes. 0 means not set.
    uint8 public constant OUTCOME_A = 1;
    uint8 public constant OUTCOME_B = 2;
    uint8 public constant OUTCOME_VOID = 3;

    /// @notice `PointsCredited` kinds (ranked credits only).
    uint8 public constant KIND_COMPLETION = 1;
    uint8 public constant KIND_HITS = 2;
    uint8 public constant KIND_COMPENSATION = 3;

    /// @notice Reason recorded by `voidExpired`.
    bytes32 public constant EXPIRED_REASON = "expired";

    uint256 private constant CT_UNIT = 1e18;
    uint256 private constant BPS = 10_000;

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    /// @notice New CT (Kaia mainnet 0x91cb3B346C80ff965a9667ba6228834dbedD71a2).
    IERC20 public immutable CT;

    /// @notice Markets by id (`dayId * 5 + slot`).
    mapping(uint256 marketId => Market) public markets;
    /// @notice Each player's answers per day.
    mapping(address user => mapping(uint32 dayId => UserDay)) public userDays;
    /// @notice Players by wallet.
    mapping(address user => Player) public players;
    /// @notice Invite counters per inviter.
    mapping(address referrer => ReferralStats) public referralStats;
    /// @notice The one play key of each player.
    mapping(address player => PlayKey) public playKeyOf;
    /// @notice The player a play key serves (kept after expiry until replaced or revoked).
    mapping(address key => address player) public playerOfKey;
    /// @notice Point balances.
    mapping(address user => uint256) public balanceOf;
    /// @notice Total points in existence.
    uint256 public totalSupply;
    /// @notice Ranked points per week (completion, hits, compensation; never invite or welcome bonus).
    mapping(uint32 weekId => mapping(address user => WeekScore)) public weekPoints;
    /// @notice True once a week's airdrop ran.
    mapping(uint32 weekId => bool) public airdropDone;
    /// @notice True once a user was compensated for a market.
    mapping(uint256 marketId => mapping(address user => bool)) public compensated;
    /// @notice CT (base units) converted by a user on a day.
    mapping(address user => mapping(uint32 dayId => uint256)) public convertedCtOnDay;
    /// @notice CT (base units) converted by everyone on a day.
    mapping(uint32 dayId => uint256) public convertedCtTotalOnDay;

    Params private _params;
    Params private _pending;
    /// @notice When the pending parameters may be applied; 0 = nothing pending.
    uint64 public pendingApplyAfter;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// @notice Point mint (`from` 0) or burn (`to` 0). Points never move between holders.
    event Transfer(address indexed from, address indexed to, uint256 value);
    event PlayerRegistered(address indexed wallet);
    event PlayerFrozen(address indexed wallet, bool frozen, bytes32 reason);
    event PlayKeySet(address indexed player, address indexed key, uint64 expiresAt);
    event PlayKeyRevoked(address indexed player, address indexed key);
    event DayCreated(uint32 indexed dayId, bytes32[5] contentHashes);
    /// @notice `user` is always the player, never the play key.
    event Predicted(address indexed user, uint256 indexed marketId, uint32 indexed dayId, uint8 choice, uint8 answered);
    /// @notice Ranked credits only: kind 1 completion, 2 hits, 3 compensation.
    event PointsCredited(address indexed user, uint32 indexed weekId, uint32 dayId, uint8 kind, uint256 amount);
    event ReferrerSet(address indexed player, address indexed referrer);
    /// @notice Invite bonus, not ranked.
    event ReferralPaid(address indexed referrer, address indexed player, uint8 sourceKind, uint256 amount);
    /// @notice Invite bonus not minted because the inviter was on hold (frozen); it is never paid later.
    event ReferralSkipped(address indexed referrer, address indexed player, uint8 sourceKind, uint256 amount);
    /// @notice Welcome bonus, not ranked.
    event WelcomePaid(address indexed player, address indexed referrer, uint32 dayId, uint256 amount);
    event OutcomeSet(uint256 indexed marketId, uint8 outcome, bool correction);
    event MarketVoided(uint256 indexed marketId, bytes32 reason);
    event Settled(address indexed user, uint32 indexed dayId, uint8 slotsMask, uint8 hits, uint256 points);
    event CorrectedOutcomeSet(uint256 indexed marketId, uint8 outcome);
    event Compensated(uint256 indexed marketId, address indexed user, uint256 points);
    event Converted(address indexed user, uint256 points, uint256 ctAmount);
    event AirdropPaid(uint32 indexed weekId, uint8 rank, address indexed user, uint256 amount);
    event ParamsProposed(Params p, uint64 applyAfter);
    event ParamsApplied(Params p);
    event ParamsCancelled();
    event ReserveWithdrawn(address indexed to, uint256 amount);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error NotRegistered();
    error AlreadyRegistered();
    error Frozen();
    error DayNotOpen();
    error MarketClosed();
    error AlreadyPredicted(uint256 marketId);
    error BadChoice();
    error DayExists();
    error BadTimes();
    error EmptyContentHash();
    error UnknownMarket();
    error NotResolvable();
    error AlreadyResolved();
    error SameOutcome();
    error CorrectionWindowOver();
    error NotReadyToSettle();
    error AlreadySettled();
    error NothingToCompensate();
    error BelowMinimum();
    error NotMultipleOfRate();
    error InsufficientPoints(uint256 balance, uint256 needed);
    error AccountTooNew();
    error DailyCapReached(uint256 left);
    error InsufficientReserve(uint256 available, uint256 needed);
    error WeekNotOver();
    error AirdropDone();
    error BadWinners();
    error PoolTooLarge();
    error ParamOutOfBounds(uint8 which);
    error TooEarly();
    error NoPendingParams();
    error PointsNonTransferable();
    error ZeroAddress();
    error ZeroAmount();
    error NotTreasury();
    error BatchTooLarge();
    error LengthMismatch();
    error BadPlayKey();
    error PlayKeyTaken();
    error AddressIsPlayKey();
    error BadExpiry();
    error NoPlayKey();
    error ResolveDeadlinePassed();
    error NotExpired();
    error ReferrerAlreadySet();
    error BadReferrer();
    error InviteWindowClosed();
    error DecimalsMismatch();

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /// @param ct       New CT (18 decimals).
    /// @param owner_   The owner (default admin): the master wallet. Also gets PAUSER.
    /// @param operator The operator hot key. Also gets PAUSER.
    /// @param treasury Where reserve withdrawals go (the master wallet at launch).
    constructor(IERC20 ct, address owner_, address operator, address treasury)
        AccessControlDefaultAdminRules(ADMIN_TRANSFER_DELAY, owner_)
    {
        if (address(ct) == address(0) || operator == address(0) || treasury == address(0)) revert ZeroAddress();
        if (IERC20Metadata(address(ct)).decimals() != 18) revert DecimalsMismatch();
        CT = ct;
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(PAUSER_ROLE, operator);
        _grantRole(PAUSER_ROLE, owner_);

        Params memory p;
        p.completionPoints = 100;
        p.hitPoints = 50;
        p.referralBps = 1_000;
        p.welcomePoints = 100;
        p.settleDelay = 6 hours;
        p.pointsPerCT = 1_000;
        p.minConvertPoints = 1_000;
        p.maxConvertCtPerUserPerDay = 50;
        p.maxConvertCtPerDay = 20_000;
        p.minAccountAge = 7 days;
        p.minResolveGap = 1 hours;
        p.maxWeeklyPool = 10_000;
        p.airdropDelay = 60 hours;
        p.treasury = treasury;
        p.splitBps = [uint16(3000), 2000, 1500, 1000, 700, 500, 400, 300, 300, 300];
        PredictLogic.checkParams(p);
        _params = p;
        emit ParamsApplied(p);
    }

    // ------------------------------------------------------------------
    // Soulbound ERC-20 shape
    // ------------------------------------------------------------------

    /// @notice "Cojam Points".
    function name() external pure returns (string memory) {
        return "Cojam Points";
    }

    /// @notice "CJP".
    function symbol() external pure returns (string memory) {
        return "CJP";
    }

    /// @notice Points are whole numbers.
    function decimals() external pure returns (uint8) {
        return 0;
    }

    /// @notice Always 0: points cannot be approved.
    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    /// @notice Always reverts: points are not transferable.
    function transfer(address, uint256) external pure returns (bool) {
        revert PointsNonTransferable();
    }

    /// @notice Always reverts: points are not transferable.
    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert PointsNonTransferable();
    }

    /// @notice Always reverts: points cannot be approved.
    function approve(address, uint256) external pure returns (bool) {
        revert PointsNonTransferable();
    }

    // ------------------------------------------------------------------
    // Players, invites, freezes (OPERATOR)
    // ------------------------------------------------------------------

    /// @notice Registers a Privy wallet as a player and, when `referrer` is not 0, links its inviter.
    function registerPlayer(address wallet, address referrer) external onlyRole(OPERATOR_ROLE) {
        _register(wallet, referrer);
    }

    /// @notice Batch form of `registerPlayer` (at most 200). Any invalid entry reverts the whole batch.
    function registerPlayers(address[] calldata wallets, address[] calldata referrers)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _checkBatch(wallets.length, referrers.length, MAX_BATCH);
        for (uint256 i = 0; i < wallets.length; ++i) {
            _register(wallets[i], referrers[i]);
        }
    }

    /// @notice Links `referrer` as the inviter of `player`, once, within `INVITE_WINDOW` (24 hours) of the
    /// player's registration, when registration set no inviter.
    function setReferrer(address player, address referrer) external onlyRole(OPERATOR_ROLE) {
        _setReferrer(player, referrer);
    }

    /// @notice Batch form of `setReferrer` (at most 200). Any invalid entry reverts the whole batch.
    function setReferrers(address[] calldata players_, address[] calldata referrers)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _checkBatch(players_.length, referrers.length, MAX_BATCH);
        for (uint256 i = 0; i < players_.length; ++i) {
            _setReferrer(players_[i], referrers[i]);
        }
    }

    /// @notice Freezes or unfreezes a player. Balances are never reduced.
    function setFrozen(address wallet, bool frozen, bytes32 reason) external onlyRole(OPERATOR_ROLE) {
        _setFrozen(wallet, frozen, reason);
    }

    /// @notice Batch form of `setFrozen` (at most 200), one reason per wallet.
    function setFrozenMany(address[] calldata wallets, bool frozen, bytes32[] calldata reasons)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _checkBatch(wallets.length, reasons.length, MAX_BATCH);
        for (uint256 i = 0; i < wallets.length; ++i) {
            _setFrozen(wallets[i], frozen, reasons[i]);
        }
    }

    // ------------------------------------------------------------------
    // Play keys (the player)
    // ------------------------------------------------------------------

    /// @notice Binds `key` as the caller's play key until `expiresAt`. Replaces (unbinds) the caller's
    /// previous key. Calling it again with the same key renews the expiry.
    function setPlayKey(address key, uint64 expiresAt) external {
        Player memory p = players[msg.sender];
        if (!p.registered) revert NotRegistered();
        if (p.frozen) revert Frozen();
        if (key == address(0) || key == msg.sender || players[key].registered) revert BadPlayKey();
        address boundTo = playerOfKey[key];
        if (boundTo != address(0) && boundTo != msg.sender) revert PlayKeyTaken();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_PLAY_KEY_TTL) revert BadExpiry();

        address old = playKeyOf[msg.sender].key;
        if (old != address(0) && old != key) {
            delete playerOfKey[old];
            emit PlayKeyRevoked(msg.sender, old);
        }
        playKeyOf[msg.sender] = PlayKey({key: key, expiresAt: expiresAt});
        playerOfKey[key] = msg.sender;
        emit PlayKeySet(msg.sender, key, expiresAt);
    }

    /// @notice Unbinds the play key. Callable by the player or by the bound key itself (even expired).
    function revokePlayKey() external {
        address player = playerOfKey[msg.sender];
        address key;
        if (player != address(0)) {
            key = msg.sender;
        } else {
            player = msg.sender;
            key = playKeyOf[player].key;
            if (key == address(0)) revert NoPlayKey();
        }
        delete playKeyOf[player];
        delete playerOfKey[key];
        emit PlayKeyRevoked(player, key);
    }

    // ------------------------------------------------------------------
    // Days and markets (OPERATOR)
    // ------------------------------------------------------------------

    /// @notice Publishes the 5 markets of `dayId`, before the day opens.
    /// @dev Every `closesAt` equals the day's end (open + 1 day); `resolvesAt` lies in
    /// [closesAt + minResolveGap, open + 2 days]; every content hash is set. See `PredictLogic.createDay`.
    function createDay(uint32 dayId, MarketInput[5] calldata m) external onlyRole(OPERATOR_ROLE) {
        bytes32[5] memory hashes = PredictLogic.createDay(markets, dayId, m, _params.minResolveGap);
        emit DayCreated(dayId, hashes);
    }

    /// @notice Sets the outcome (1 A, 2 B, 3 void) once, between `resolvesAt` and the resolve deadline.
    /// Starts the correction window: hits of this market are credited from `resolvedAt + settleDelay`.
    function setOutcome(uint256 marketId, uint8 outcome) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        if (outcome == 0 || outcome > OUTCOME_VOID) revert BadChoice();
        if (m.outcome != 0) revert AlreadyResolved();
        if (block.timestamp < m.resolvesAt) revert NotResolvable();
        if (block.timestamp >= _dayEnd(marketId) + RESOLVE_DEADLINE) revert ResolveDeadlinePassed();
        m.outcome = outcome;
        m.resolvedAt = SafeCast.toUint40(block.timestamp);
        m.settlesAt = SafeCast.toUint40(block.timestamp + _params.settleDelay);
        emit OutcomeSet(marketId, outcome, false);
    }

    /// @notice Replaces the outcome inside the correction window (before anyone can be settled).
    function correctOutcome(uint256 marketId, uint8 outcome) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        if (outcome == 0 || outcome > OUTCOME_VOID) revert BadChoice();
        uint8 current = m.outcome;
        if (current == 0) revert NotResolvable();
        if (block.timestamp >= m.settlesAt) revert CorrectionWindowOver();
        if (current == outcome) revert SameOutcome();
        m.outcome = outcome;
        emit OutcomeSet(marketId, outcome, true);
    }

    /// @notice Voids a market that is unresolved or still inside its correction window. Final at once.
    function voidMarket(uint256 marketId, bytes32 reason) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        uint8 current = m.outcome;
        if (current == OUTCOME_VOID) revert AlreadyResolved();
        if (current != 0 && block.timestamp >= m.settlesAt) revert CorrectionWindowOver();
        _void(m, marketId, reason);
    }

    /// @notice Voids a market nobody resolved by its day's end plus `RESOLVE_DEADLINE`. Anyone may call it.
    function voidExpired(uint256 marketId) external {
        Market storage m = _market(marketId);
        if (m.outcome != 0) revert AlreadyResolved();
        if (block.timestamp < _dayEnd(marketId) + RESOLVE_DEADLINE) revert NotExpired();
        _void(m, marketId, EXPIRED_REASON);
    }

    /// @notice Owner: records the true answer of a market whose correction window is over, once.
    /// It changes no past credit; it only enables `compensate` for users who picked it.
    function setCorrectedOutcome(uint256 marketId, uint8 outcome) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Market storage m = _market(marketId);
        if (outcome != OUTCOME_A && outcome != OUTCOME_B) revert BadChoice();
        uint8 current = m.outcome;
        if (current == 0 || block.timestamp < m.settlesAt) revert TooEarly();
        if (m.correctedOutcome != 0) revert AlreadyResolved();
        if (current == outcome) revert SameOutcome();
        m.correctedOutcome = outcome;
        emit CorrectedOutcomeSet(marketId, outcome);
    }

    // ------------------------------------------------------------------
    // Predictions
    // ------------------------------------------------------------------

    /// @notice Answers market `marketId` with `choice` (1 or 2) for the caller's player: the caller
    /// itself, or the player whose current play key is the caller. The fifth answer of a day credits
    /// the completion points (plus the invite bonus to the inviter and, once, the welcome bonus).
    function predict(uint256 marketId, uint8 choice) external whenNotPaused {
        address player = msg.sender;
        address boundTo = playerOfKey[msg.sender];
        if (boundTo != address(0)) {
            PlayKey memory k = playKeyOf[boundTo];
            if (k.key != msg.sender || block.timestamp >= k.expiresAt) revert BadPlayKey();
            player = boundTo;
        }
        Player memory p = players[player];
        if (!p.registered) revert NotRegistered();
        if (p.frozen) revert Frozen();
        if (choice != OUTCOME_A && choice != OUTCOME_B) revert BadChoice();

        uint256 closesAt = markets[marketId].closesAt;
        if (closesAt == 0) revert DayNotOpen();
        // The market exists, so its day id came from a uint32 in createDay.
        uint32 dayId = uint32(marketId / SLOTS);
        if (block.timestamp < uint256(dayId) * 1 days) revert DayNotOpen();
        if (block.timestamp >= closesAt) revert MarketClosed();

        UserDay storage ud = userDays[player][dayId];
        uint256 shift = (marketId % SLOTS) * 2;
        uint16 choices = ud.choices;
        if ((choices >> shift) & 3 != 0) revert AlreadyPredicted(marketId);
        uint8 answered = ud.answered + 1;
        bool done = answered == SLOTS;
        ud.choices = choices | uint16(uint256(choice) << shift);
        ud.answered = answered;
        if (done) ud.completed = true;
        emit Predicted(player, marketId, dayId, choice, answered);

        if (done) _completeDay(player, p, dayId);
    }

    // ------------------------------------------------------------------
    // Settlement and compensation
    // ------------------------------------------------------------------

    /// @notice Credits `user`'s hit points for every answered market of `dayId` whose settle time has
    /// passed and that is not settled for `user` yet. Anyone may call it; it may run several times a day.
    /// @return points Hit points credited by this call.
    function settle(address user, uint32 dayId) external returns (uint256 points) {
        (uint256 ready, uint256 outcomes) = _readyMarkets(dayId);
        uint256 status;
        (status, points) = _settle(user, dayId, ready, outcomes, _params.hitPoints);
        if (status == 1) revert NotReadyToSettle();
        if (status == 2) revert AlreadySettled();
    }

    /// @notice Batch form of `settle` for keepers (at most 200 users). Users with nothing ready are
    /// skipped. Reverts `NotReadyToSettle` when nobody was settled.
    /// @return count Users settled by this call.
    function settleMany(address[] calldata users, uint32 dayId) external returns (uint256 count) {
        if (users.length > MAX_BATCH) revert BatchTooLarge();
        (uint256 ready, uint256 outcomes) = _readyMarkets(dayId);
        uint256 hitPoints = _params.hitPoints;
        for (uint256 i = 0; i < users.length; ++i) {
            (uint256 status,) = _settle(users[i], dayId, ready, outcomes, hitPoints);
            if (status == 0) ++count;
        }
        if (count == 0) revert NotReadyToSettle();
    }

    /// @notice Pays `hitPoints` to each listed user who was settled on `marketId` with the choice
    /// that the owner recorded as the corrected outcome, once per user. Users that do not qualify are
    /// skipped; reverts `NothingToCompensate` when nobody qualified. At most 500 users.
    /// @return count Users compensated by this call.
    function compensate(uint256 marketId, address[] calldata users)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256 count)
    {
        if (users.length > MAX_COMPENSATE_BATCH) revert BatchTooLarge();
        uint256 corrected = _market(marketId).correctedOutcome;
        if (corrected == 0) revert NothingToCompensate();
        uint32 dayId = uint32(marketId / SLOTS);
        // The question's week while its airdrop is not sent, else the current week (DECISIONS
        // "Compensation points").
        uint32 weekId = weekOf(dayId);
        if (airdropDone[weekId]) weekId = weekOf(currentDay());
        uint256 slot = marketId % SLOTS;
        uint256 amount = _params.hitPoints;
        for (uint256 i = 0; i < users.length; ++i) {
            address user = users[i];
            UserDay memory u = userDays[user][dayId];
            if ((u.settledMask >> slot) & 1 == 0) continue;
            if ((u.choices >> (slot * 2)) & 3 != corrected) continue;
            if (compensated[marketId][user]) continue;
            compensated[marketId][user] = true;
            ++count;
            emit Compensated(marketId, user, amount);
            if (amount != 0) _credit(user, amount, KIND_COMPENSATION, weekId, dayId);
        }
        if (count == 0) revert NothingToCompensate();
    }

    // ------------------------------------------------------------------
    // Conversion and airdrop (CT out)
    // ------------------------------------------------------------------

    /// @notice Burns `points` of the caller's points and sends `points * 1e18 / pointsPerCT` CT from
    /// the reserve. Needs a registered, unfrozen account older than `minAccountAge`, a multiple of the
    /// rate at or above the minimum, and room under the caller's and the global daily CT caps.
    /// @return ctAmount CT sent (base units).
    function convert(uint256 points) external nonReentrant whenNotPaused returns (uint256 ctAmount) {
        Player memory p = players[msg.sender];
        if (!p.registered) revert NotRegistered();
        if (p.frozen) revert Frozen();
        Params storage q = _params;
        uint256 rate = q.pointsPerCT;
        if (points < q.minConvertPoints) revert BelowMinimum();
        if (points % rate != 0) revert NotMultipleOfRate();
        if (block.timestamp < uint256(p.registeredAt) + q.minAccountAge) revert AccountTooNew();
        uint256 bal = balanceOf[msg.sender];
        if (bal < points) revert InsufficientPoints(bal, points);

        ctAmount = (points * CT_UNIT) / rate;
        uint32 day = currentDay();
        uint256 userCap = uint256(q.maxConvertCtPerUserPerDay) * CT_UNIT;
        uint256 userUsed = convertedCtOnDay[msg.sender][day];
        if (userUsed + ctAmount > userCap) revert DailyCapReached(userCap - userUsed);
        uint256 dayCap = uint256(q.maxConvertCtPerDay) * CT_UNIT;
        uint256 dayUsed = convertedCtTotalOnDay[day];
        if (dayUsed + ctAmount > dayCap) revert DailyCapReached(dayCap - dayUsed);
        uint256 available = CT.balanceOf(address(this));
        if (available < ctAmount) revert InsufficientReserve(available, ctAmount);

        convertedCtOnDay[msg.sender][day] = userUsed + ctAmount;
        convertedCtTotalOnDay[day] = dayUsed + ctAmount;
        balanceOf[msg.sender] = bal - points;
        totalSupply -= points;
        emit Transfer(msg.sender, address(0), points);
        emit Converted(msg.sender, points, ctAmount);

        CT.safeTransfer(msg.sender, ctAmount);
    }

    /// @notice Pays the weekly airdrop of week `weekId`: `pool * splitBps[i] / 10000` to the i-th winner.
    /// Winners must be registered, unfrozen, have ranked points that week and be strictly ordered by
    /// points (higher first), then by `lastCreditAt` (earlier first), then by address (lower first).
    /// Once per week, `airdropDelay` after the week's end, `pool <= maxWeeklyPool`.
    function airdrop(uint32 weekId, address[] calldata winners, uint256 pool)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        Params storage q = _params;
        if (block.timestamp < weekEnd(weekId) + q.airdropDelay) revert WeekNotOver();
        if (airdropDone[weekId]) revert AirdropDone();
        uint256 n = winners.length;
        if (n == 0 || n > MAX_WINNERS) revert BadWinners();
        if (pool > uint256(q.maxWeeklyPool) * CT_UNIT) revert PoolTooLarge();

        (uint256[] memory amounts, uint256 total) =
            PredictLogic.checkWinners(players, weekPoints[weekId], winners, pool, q.splitBps);
        uint256 available = CT.balanceOf(address(this));
        if (available < total) revert InsufficientReserve(available, total);

        airdropDone[weekId] = true;
        for (uint256 i = 0; i < n; ++i) {
            emit AirdropPaid(weekId, uint8(i + 1), winners[i], amounts[i]);
        }
        for (uint256 i = 0; i < n; ++i) {
            if (amounts[i] != 0) CT.safeTransfer(winners[i], amounts[i]);
        }
    }

    // ------------------------------------------------------------------
    // Owner: parameters, pause, reserve
    // ------------------------------------------------------------------

    /// @notice Announces new parameters, applicable after `PARAM_DELAY`. Replaces any pending proposal
    /// (and restarts the delay).
    function proposeParams(Params calldata p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint64 applyAfter = SafeCast.toUint64(block.timestamp + PARAM_DELAY);
        pendingApplyAfter = applyAfter;
        PredictLogic.propose(_pending, p, applyAfter);
    }

    /// @notice Applies the pending parameters once their delay has passed.
    function applyParams() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint64 applyAfter = pendingApplyAfter;
        if (applyAfter == 0) revert NoPendingParams();
        if (block.timestamp < applyAfter) revert TooEarly();
        pendingApplyAfter = 0;
        PredictLogic.applyPending(_params, _pending);
    }

    /// @notice Drops the pending parameters.
    function cancelParams() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pendingApplyAfter == 0) revert NoPendingParams();
        delete _pending;
        pendingApplyAfter = 0;
        emit ParamsCancelled();
    }

    /// @notice Pauses `predict` and `convert`. Settle, compensate, airdrop and views keep working.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Owner only.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Owner: sends `amount` CT of the reserve to the treasury (`to` must equal it).
    function withdrawReserve(uint256 amount, address to) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to != _params.treasury) revert NotTreasury();
        if (amount == 0) revert ZeroAmount();
        uint256 available = CT.balanceOf(address(this));
        if (available < amount) revert InsufficientReserve(available, amount);
        emit ReserveWithdrawn(to, amount);
        CT.safeTransfer(to, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Current parameters.
    function params() external view returns (Params memory) {
        return _params;
    }

    /// @notice Pending parameters and when they may be applied (0 = nothing pending).
    function pendingParams() external view returns (Params memory p, uint64 applyAfter) {
        return (_pending, pendingApplyAfter);
    }

    /// @notice UTC day number of now (day d opens at d * 86400 = 09:00 KST / JST).
    function currentDay() public view returns (uint32) {
        return SafeCast.toUint32(block.timestamp / 1 days);
    }

    /// @notice Week of a day: weeks run Monday 00:00 UTC to the next Monday 00:00 UTC.
    function weekOf(uint32 dayId) public pure returns (uint32) {
        return uint32((uint256(dayId) + 3) / 7);
    }

    /// @notice Timestamp at which week `weekId` ends (the next Monday 00:00 UTC).
    function weekEnd(uint32 weekId) public pure returns (uint256) {
        return (uint256(weekId) * 7 + 4) * 1 days;
    }

    /// @notice CT held by this contract (pays conversions and airdrops).
    function reserve() public view returns (uint256) {
        return CT.balanceOf(address(this));
    }

    /// @notice CT a conversion of `points` would pay at the current rate (ignores caps and checks).
    function previewConvert(uint256 points) external view returns (uint256) {
        return (points * CT_UNIT) / _params.pointsPerCT;
    }

    /// @notice A player's day in readable form.
    function dayOf(address user, uint32 dayId)
        external
        view
        returns (uint8 answered, uint8[5] memory choices, bool completed, uint8 settledMask, uint8 hits)
    {
        UserDay memory u = userDays[user][dayId];
        for (uint256 i = 0; i < SLOTS; ++i) {
            choices[i] = uint8((u.choices >> (i * 2)) & 3);
        }
        return (u.answered, choices, u.completed, u.settledMask, u.hits);
    }

    /// @notice Hit points of `user` on `dayId` from markets that are resolved but not settled for the
    /// user yet, and the latest settle time among those markets (0 when there are none).
    function pendingHits(address user, uint32 dayId) external view returns (uint256 points, uint256 landsAt) {
        uint256 hits;
        (hits, landsAt) = PredictLogic.pendingHits(markets, userDays[user][dayId], dayId);
        points = hits * _params.hitPoints;
    }

    /// @notice The player a key serves, its expiry and whether it may predict now.
    function playerOf(address key) external view returns (address player, uint64 expiresAt, bool valid) {
        player = playerOfKey[key];
        if (player == address(0)) return (address(0), 0, false);
        expiresAt = playKeyOf[player].expiresAt;
        valid = block.timestamp < expiresAt;
    }

    /// @notice Inviter of `player` (0 = none).
    function referrerOf(address player) external view returns (address) {
        return players[player].referrer;
    }

    /// @notice Invite bonus points `referrer` has received in total.
    function referralPointsOf(address referrer) external view returns (uint256) {
        return referralStats[referrer].points;
    }

    /// @notice Players linked to `referrer`.
    function referredCount(address referrer) external view returns (uint256) {
        return referralStats[referrer].count;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _register(address wallet, address referrer) private {
        if (wallet == address(0)) revert ZeroAddress();
        Player storage p = players[wallet];
        if (p.registered) revert AlreadyRegistered();
        if (playerOfKey[wallet] != address(0)) revert AddressIsPlayKey();
        p.registered = true;
        p.registeredAt = uint64(block.timestamp);
        emit PlayerRegistered(wallet);
        if (referrer != address(0)) _link(wallet, referrer);
    }

    function _setReferrer(address player, address referrer) private {
        Player storage p = players[player];
        if (!p.registered) revert NotRegistered();
        if (p.referrer != address(0)) revert ReferrerAlreadySet();
        if (block.timestamp >= uint256(p.registeredAt) + INVITE_WINDOW) revert InviteWindowClosed();
        _link(player, referrer);
        // A late code still earns the welcome bonus once (DECISIONS "Welcome bonus with a late code"):
        // paid now when the first full day is already done, else at that day as usual.
        if (p.completedOnce) _welcome(player, referrer, currentDay());
    }

    /// @dev Referrer rules shared by registration and `setReferrer`; the player is registered.
    function _link(address player, address referrer) private {
        Player storage r = players[referrer];
        if (referrer == player || !r.registered || r.frozen || r.referrer == player) revert BadReferrer();
        players[player].referrer = referrer;
        ++referralStats[referrer].count;
        emit ReferrerSet(player, referrer);
    }

    function _setFrozen(address wallet, bool frozen, bytes32 reason) private {
        Player storage p = players[wallet];
        if (!p.registered) revert NotRegistered();
        p.frozen = frozen;
        emit PlayerFrozen(wallet, frozen, reason);
    }

    function _checkBatch(uint256 a, uint256 b, uint256 cap) private pure {
        if (a != b) revert LengthMismatch();
        if (a > cap) revert BatchTooLarge();
    }

    /// @dev Completion credit of the fifth answer and, on the player's first completed day, the
    /// welcome bonus (not ranked, earns the inviter nothing).
    function _completeDay(address player, Player memory p, uint32 dayId) private {
        uint256 cp = _params.completionPoints;
        if (cp != 0) _credit(player, cp, KIND_COMPLETION, weekOf(dayId), dayId);
        if (p.completedOnce) return;
        players[player].completedOnce = true;
        if (p.referrer != address(0)) _welcome(player, p.referrer, dayId);
    }

    /// @dev Welcome bonus, once per player: at the first completed day when an inviter is linked, or at
    /// a late link (`setReferrer`) when that day is already behind. Not paid while the inviter is frozen
    /// (and not later); never ranked; earns the inviter nothing. A linked inviter is always registered.
    function _welcome(address player, address r, uint32 dayId) private {
        uint256 wp = _params.welcomePoints;
        if (wp == 0 || players[r].frozen) return;
        _mint(player, wp);
        emit WelcomePaid(player, r, dayId, wp);
    }

    /// @dev Ranked credit (counts in `weekPoints`) plus the invite bonus to an active inviter of an
    /// unfrozen player: `amount * referralBps / 10000`, rounded down, never ranked.
    function _credit(address player, uint256 amount, uint8 kind, uint32 weekId, uint32 dayId) private {
        _mint(player, amount);
        WeekScore storage w = weekPoints[weekId][player];
        w.points += SafeCast.toUint192(amount);
        w.lastCreditAt = uint64(block.timestamp);
        emit PointsCredited(player, weekId, dayId, kind, amount);

        Player memory p = players[player];
        address r = p.referrer;
        if (r == address(0) || p.frozen) return;
        uint256 bps = _params.referralBps;
        if (bps == 0) return;
        uint256 bonus = (amount * bps) / BPS;
        if (bonus == 0) return;
        // A linked inviter is always registered. While the inviter is on hold the bonus is not minted
        // and never owed later (DECISIONS "On hold: staking and invites").
        if (players[r].frozen) {
            emit ReferralSkipped(r, player, kind, bonus);
            return;
        }
        _mint(r, bonus);
        referralStats[r].points += SafeCast.toUint128(bonus);
        emit ReferralPaid(r, player, kind, bonus);
    }

    function _mint(address to, uint256 amount) private {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @dev Bit i of `ready`: market i of the day has an outcome and its settle time has passed.
    /// Byte i of `outcomes`: that market's outcome.
    function _readyMarkets(uint32 dayId) private view returns (uint256 ready, uint256 outcomes) {
        uint256 first = uint256(dayId) * SLOTS;
        for (uint256 i = 0; i < SLOTS; ++i) {
            Market storage m = markets[first + i];
            uint256 o = m.outcome;
            if (o != 0 && block.timestamp >= m.settlesAt) {
                ready |= 1 << i;
                outcomes |= o << (i * 8);
            }
        }
    }

    /// @dev Status 0 settled, 1 nothing ready, 2 every answered market already settled.
    function _settle(address user, uint32 dayId, uint256 ready, uint256 outcomes, uint256 hitPoints)
        private
        returns (uint256 status, uint256 points)
    {
        UserDay storage ud = userDays[user][dayId];
        (uint256 st, uint256 todo, uint256 newHits) = _scan(ud.choices, ud.settledMask, ready, outcomes);
        if (st != 0) return (st, 0);
        ud.settledMask = uint8(ud.settledMask | todo);
        if (newHits != 0) ud.hits = uint8(ud.hits + newHits);
        points = newHits * hitPoints;
        emit Settled(user, dayId, uint8(todo), uint8(newHits), points);
        if (points != 0) _credit(user, points, KIND_HITS, weekOf(dayId), dayId);
    }

    /// @dev Which answered slots are ready and unsettled (`todo`) and how many of them are hits.
    function _scan(uint256 choices, uint256 settledMask, uint256 ready, uint256 outcomes)
        private
        pure
        returns (uint256 status, uint256 todo, uint256 hits)
    {
        uint256 answeredMask;
        for (uint256 i = 0; i < SLOTS; ++i) {
            if ((choices >> (i * 2)) & 3 != 0) answeredMask |= 1 << i;
        }
        uint256 open = answeredMask & ~settledMask;
        if (answeredMask != 0 && open == 0) return (2, 0, 0);
        todo = open & ready;
        if (todo == 0) return (1, 0, 0);
        for (uint256 i = 0; i < SLOTS; ++i) {
            if ((todo >> i) & 1 == 0) continue;
            if ((choices >> (i * 2)) & 3 == (outcomes >> (i * 8)) & 0xff) ++hits;
        }
    }

    function _void(Market storage m, uint256 marketId, bytes32 reason) private {
        uint40 nowTs = SafeCast.toUint40(block.timestamp);
        m.outcome = OUTCOME_VOID;
        if (m.resolvedAt == 0) m.resolvedAt = nowTs;
        m.settlesAt = nowTs;
        emit MarketVoided(marketId, reason);
    }

    function _market(uint256 marketId) private view returns (Market storage m) {
        m = markets[marketId];
        if (m.closesAt == 0) revert UnknownMarket();
    }

    function _dayEnd(uint256 marketId) private pure returns (uint256) {
        return (marketId / SLOTS + 1) * 1 days;
    }
}
