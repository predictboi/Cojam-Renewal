// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Params, MarketInput, Market, UserDay, Player, WeekScore} from "./PredictTypes.sol";

/// @title Linked library of `CojamPredict`
/// @notice Holds the parameter bounds, day creation, airdrop winner checks and two views of
/// `CojamPredict`, so the contract stays under the 24,576 byte code size limit. Its external functions
/// run by DELEGATECALL in the context of `CojamPredict` (storage arguments are that contract's
/// storage); the library has no state, no owner and no upgrade. Deploy it once and link it.
/// @dev The errors repeat `CojamPredict`'s errors with the same signatures, so callers decode them
/// with the contract's ABI.
library PredictLogic {
    uint256 private constant SLOTS = 5;
    uint256 private constant BPS = 10_000;
    uint256 private constant RESOLVE_DEADLINE = 48 hours;

    error ParamOutOfBounds(uint8 which);
    error BadTimes();
    error DayExists();
    error EmptyContentHash();
    error NotRegistered();
    error Frozen();
    error BadWinners();

    /// @notice Same signatures as in `CojamPredict`; emitted here, logged by `CojamPredict`.
    event ParamsProposed(Params p, uint64 applyAfter);
    event ParamsApplied(Params p);

    /// @notice Reverts `ParamOutOfBounds(which)` unless every field of `p` lies inside the bounds of
    /// section 3.6 of the development plan. `which` numbers the fields in declaration order (0 to 15).
    function checkParams(Params memory p) public pure {
        if (p.completionPoints > 1_000) revert ParamOutOfBounds(0);
        if (p.hitPoints > 1_000) revert ParamOutOfBounds(1);
        if (p.referralBps > 2_000) revert ParamOutOfBounds(2);
        if (p.welcomePoints > 1_000) revert ParamOutOfBounds(3);
        if (p.settleDelay > 48 hours) revert ParamOutOfBounds(4);
        if (p.pointsPerCT < 100 || p.pointsPerCT > 100_000) revert ParamOutOfBounds(5);
        if (p.minConvertPoints < p.pointsPerCT || p.minConvertPoints > 1_000_000) revert ParamOutOfBounds(6);
        if (p.maxConvertCtPerUserPerDay == 0 || p.maxConvertCtPerUserPerDay > 10_000) revert ParamOutOfBounds(7);
        if (p.maxConvertCtPerDay < 100 || p.maxConvertCtPerDay > 1_000_000) revert ParamOutOfBounds(8);
        if (p.minAccountAge > 30 days) revert ParamOutOfBounds(9);
        if (p.minResolveGap > 7 days) revert ParamOutOfBounds(10);
        if (p.maxWeeklyPool > 1_000_000) revert ParamOutOfBounds(11);
        if (p.airdropDelay < RESOLVE_DEADLINE + p.settleDelay || p.airdropDelay > 7 days) {
            revert ParamOutOfBounds(12);
        }
        if (p.treasury == address(0)) revert ParamOutOfBounds(13);
        uint256 sum;
        for (uint256 i = 0; i < 10; ++i) {
            if (i > 0 && p.splitBps[i] > p.splitBps[i - 1]) revert ParamOutOfBounds(14);
            sum += p.splitBps[i];
        }
        if (sum != BPS) revert ParamOutOfBounds(14);
        // At least minResolveGap, so a valid resolve time always exists (DECISIONS "Longer questions mixed in").
        uint256 maxAfter = p.maxResolveAfterClose;
        if (maxAfter < 1 days || maxAfter > 90 days || maxAfter < p.minResolveGap) revert ParamOutOfBounds(15);
    }

    /// @notice Checks `p` and stores it as the pending proposal.
    function propose(Params storage pending, Params memory p, uint64 applyAfter) external {
        checkParams(p);
        _copy(pending, p);
        emit ParamsProposed(p, applyAfter);
    }

    /// @notice Makes the pending proposal current and clears it.
    function applyPending(Params storage current, Params storage pending) external {
        Params memory p = pending;
        _copy(current, p);
        _clear(pending);
        emit ParamsApplied(p);
    }

    /// @notice Checks and writes the 5 markets of `dayId`: before the day opens, or after it opened while at
    /// least 1 hour remains before its end (`block.timestamp + 1 hours <= dayEnd`), so a missed run does not
    /// lose the day. Every `closesAt` equals the day's end, open + 1 day (DECISIONS "Question timing": all
    /// five stay open the whole day); each `resolvesAt` lies in [closesAt + minResolveGap,
    /// closesAt + maxResolveAfterClose] (DECISIONS "Longer questions mixed in"), so markets of one day may
    /// resolve weeks apart; every content hash is set. Each market's outcome is refused from its own
    /// `resolvesAt + RESOLVE_DEADLINE` (48 hours), when anyone may void it.
    /// @return hashes The 5 content hashes, for the `DayCreated` event.
    function createDay(
        mapping(uint256 => Market) storage markets,
        uint32 dayId,
        MarketInput[5] calldata m,
        Params storage p
    ) external returns (bytes32[5] memory hashes) {
        uint256 open = uint256(dayId) * 1 days;
        uint256 gap = p.minResolveGap;
        uint256 maxAfter = p.maxResolveAfterClose;
        // Before the open, or late (a missed run) while at least 1 hour of the day remains; never a past day.
        if (block.timestamp + 1 hours > open + 1 days) revert BadTimes();
        uint256 first = uint256(dayId) * SLOTS;
        if (markets[first].closesAt != 0) revert DayExists();
        for (uint256 i = 0; i < SLOTS; ++i) {
            MarketInput calldata x = m[i];
            if (x.closesAt != open + 1 days) revert BadTimes(); // all five close at the day's end
            if (x.resolvesAt < x.closesAt + gap || x.resolvesAt > x.closesAt + maxAfter) revert BadTimes();
            if (x.contentHash == bytes32(0)) revert EmptyContentHash();
            Market storage mk = markets[first + i];
            mk.closesAt = SafeCast.toUint40(x.closesAt);
            mk.resolvesAt = SafeCast.toUint40(x.resolvesAt);
            mk.contentHash = x.contentHash;
            hashes[i] = x.contentHash;
        }
    }

    /// @notice Checks an airdrop list and returns each winner's amount `pool * split[i] / 10000` and
    /// the total. Winners must be registered, unfrozen, hold ranked points in the week and be strictly
    /// ordered: points (higher first), then `lastCompletionAt` (earlier first, 0 counts as the latest),
    /// then address (lower first).
    /// Strict order also makes the list free of duplicates.
    function checkWinners(
        mapping(address => Player) storage players,
        mapping(address => WeekScore) storage scores,
        address[] calldata winners,
        uint256 pool,
        uint16[10] memory split
    ) external view returns (uint256[] memory amounts, uint256 total) {
        uint256 n = winners.length;
        amounts = new uint256[](n);
        WeekScore memory prev;
        for (uint256 i = 0; i < n; ++i) {
            address w = winners[i];
            Player memory p = players[w];
            if (!p.registered) revert NotRegistered();
            if (p.frozen) revert Frozen();
            WeekScore memory s = scores[w];
            if (s.points == 0) revert BadWinners();
            if (i > 0 && !_ranksAbove(prev, winners[i - 1], s, w)) revert BadWinners();
            prev = s;
            amounts[i] = (pool * split[i]) / BPS;
            total += amounts[i];
        }
    }

    /// @notice Hit count of a user's day from markets that are resolved but not yet settled for the
    /// user, and the latest settle time among those markets (0 when there are none).
    function pendingHits(mapping(uint256 => Market) storage markets, UserDay memory u, uint32 dayId)
        external
        view
        returns (uint256 hits, uint256 landsAt)
    {
        uint256 first = uint256(dayId) * SLOTS;
        for (uint256 i = 0; i < SLOTS; ++i) {
            uint256 c = (u.choices >> (i * 2)) & 3;
            if (c == 0 || (u.settledMask >> i) & 1 == 1) continue;
            Market memory m = markets[first + i];
            if (m.outcome == 0) continue;
            if (m.settlesAt > landsAt) landsAt = m.settlesAt;
            if (m.outcome == c) ++hits;
        }
    }

    function _copy(Params storage dst, Params memory p) private {
        dst.completionPoints = p.completionPoints;
        dst.hitPoints = p.hitPoints;
        dst.referralBps = p.referralBps;
        dst.welcomePoints = p.welcomePoints;
        dst.settleDelay = p.settleDelay;
        dst.pointsPerCT = p.pointsPerCT;
        dst.minConvertPoints = p.minConvertPoints;
        dst.maxConvertCtPerUserPerDay = p.maxConvertCtPerUserPerDay;
        dst.maxConvertCtPerDay = p.maxConvertCtPerDay;
        dst.minAccountAge = p.minAccountAge;
        dst.minResolveGap = p.minResolveGap;
        dst.maxWeeklyPool = p.maxWeeklyPool;
        dst.airdropDelay = p.airdropDelay;
        dst.treasury = p.treasury;
        dst.splitBps = p.splitBps;
        dst.maxResolveAfterClose = p.maxResolveAfterClose;
    }

    function _clear(Params storage dst) private {
        Params memory empty;
        _copy(dst, empty);
    }

    /// @dev True when score `a` of `aw` ranks strictly above score `b` of `bw`.
    function _ranksAbove(WeekScore memory a, address aw, WeekScore memory b, address bw)
        private
        pure
        returns (bool)
    {
        if (a.points != b.points) return a.points > b.points;
        // 0 (ranked points but no completion in the week, only through a late compensation) is the latest.
        uint256 at = a.lastCompletionAt == 0 ? type(uint256).max : a.lastCompletionAt;
        uint256 bt = b.lastCompletionAt == 0 ? type(uint256).max : b.lastCompletionAt;
        if (at != bt) return at < bt;
        return aw < bw;
    }
}
