// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Economic parameters of `CojamPredict`. Changed only by `proposeParams` then `applyParams`
/// 48 hours later. Three storage slots; slot 1 holds everything `predict` and `convert` read.
struct Params {
    uint16 completionPoints; // points for answering all 5 markets of a day (0 to 1,000)
    uint16 hitPoints; // points per correct answer (0 to 1,000)
    uint16 referralBps; // invite bonus in basis points of each ranked credit (0 to 2,000)
    uint16 welcomePoints; // one time bonus of an invited player's first completed day (0 to 1,000)
    uint32 settleDelay; // correction window after a resolution, in seconds (0 to 48 h)
    uint32 pointsPerCT; // points per 1 CT (100 to 100,000)
    uint32 minConvertPoints; // smallest conversion (pointsPerCT to 1,000,000)
    uint32 maxConvertCtPerUserPerDay; // whole CT (1 to 10,000)
    uint32 maxConvertCtPerDay; // whole CT, all users (100 to 1,000,000)
    uint32 minAccountAge; // seconds after registration before a conversion (0 to 30 days)
    uint32 minResolveGap; // seconds between close and resolve times (0 to 7 days)
    uint32 maxWeeklyPool; // whole CT (0 to 1,000,000)
    uint32 airdropDelay; // seconds after the week's end (RESOLVE_DEADLINE + settleDelay to 7 days)
    address treasury; // where reserve withdrawals go (not zero)
    uint16[10] splitBps; // airdrop share per rank, non increasing, sum 10,000
}

/// @notice Market input of `createDay`.
struct MarketInput {
    uint64 closesAt; // predictions accepted while block.timestamp < closesAt
    uint64 resolvesAt; // outcome may be set from this time
    bytes32 contentHash; // keccak256 of the canonical EN, KO and JA texts, times and sources
}

/// @notice One market. Two storage slots.
/// @dev Timestamps are uint40 (enough until the year 36,812) so the resolution snapshot fits slot 1.
struct Market {
    uint40 closesAt; // predictions accepted while block.timestamp < closesAt; 0 = market does not exist
    uint40 resolvesAt; // outcome may be set from this time
    uint40 resolvedAt; // when the outcome (or void) was first set; 0 = not yet
    uint40 settlesAt; // end of the correction window, snapshotted at resolution (resolvedAt + settleDelay)
    uint8 outcome; // 0 none, 1 choice A, 2 choice B, 3 void
    uint8 correctedOutcome; // set by the owner only after the window (compensation path), else 0
    bytes32 contentHash;
}

/// @notice One player's day. One storage slot.
struct UserDay {
    uint8 answered; // 0..5
    uint16 choices; // 2 bits per slot: 0 none, 1 A, 2 B
    bool completed; // completion points credited
    uint8 settledMask; // bit i set: slot i settled (hit credited or not)
    uint8 hits; // hits credited by settle
}

/// @notice One player. One storage slot.
struct Player {
    address referrer; // inviter, set once; 0 = not invited
    uint64 registeredAt;
    bool registered;
    bool frozen;
    bool completedOnce; // first full day done: the welcome bonus is paid (once) only at this moment
}

/// @notice A play key binding. One storage slot; key 0 = none.
struct PlayKey {
    address key;
    uint64 expiresAt;
}

/// @notice Invite counters of an inviter. One storage slot.
struct ReferralStats {
    uint128 points; // invite bonus points received
    uint64 count; // players linked to this inviter
}

/// @notice Ranked points of a user in a week. One storage slot.
struct WeekScore {
    uint192 points;
    uint64 lastCompletionAt; // time of the last completion credit this week (0 = none): earlier ranks higher on equal points
}
