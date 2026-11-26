# CojamPredict: specification as built

Source: `contracts/platform/CojamPredict.sol`, `contracts/platform/PredictLogic.sol` (linked library), `contracts/platform/PredictTypes.sol` (structs). Built from `docs/platform/DEV-PLAN.md` draft 3, sections 3.1 to 3.9, 4, 5 and 8, amended by `docs/platform/DECISIONS.md` (every row up to "Welcome bonus with a late code"). Solidity 0.8.28, OpenZeppelin 5.4, optimizer 200, evm paris.

## 1. Shape

* One immutable contract, no proxy. Roles through `AccessControlDefaultAdminRules` (owner transfer delay 3 days), `Pausable`, `ReentrancyGuard`, `SafeERC20`.
* Deployment links the stateless library `PredictLogic` (parameter bounds, `createDay` checks and writes, airdrop winner checks, the `pendingHits` view, parameter storage copies). It runs by DELEGATECALL in the contract's context, has no state and no owner. It exists only to keep `CojamPredict` under the 24,576 byte limit (runtime size 24,055 bytes; library about 6,700 bytes). Deploy order: `PredictLogic`, then `CojamPredict(ct, owner, operator, treasury)` linked to it.
* Constructor: CT must report 18 decimals; owner, operator and treasury must not be zero. The owner gets `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE`; the operator gets `OPERATOR_ROLE` and `PAUSER_ROLE`. Default parameters are set and emitted as `ParamsApplied`.

## 2. Points ledger

"Cojam Points", "CJP", 0 decimals. `totalSupply`, `balanceOf`, `allowance` (always 0). `transfer`, `transferFrom`, `approve` always revert `PointsNonTransferable`. `Transfer(0, user, n)` on every mint, `Transfer(user, 0, n)` on every conversion; no other point movement exists.

Points are minted only by: the fifth `predict` of a day (completion, the invite bonus on it, and the one time welcome bonus), `settle` / `settleMany` (hits, invite bonus on the call's total) and `compensate` (compensation, invite bonus on it), plus `setReferrer` for one case: the welcome bonus of a late code entered after the player's first full day. They are burned only by `convert`.

## 3. Time

`dayId = timestamp / 86400` (day opens 00:00 UTC = 09:00 KST / JST). `weekId = (dayId + 3) / 7` (Monday 00:00 UTC). `weekEnd(w) = (7w + 4) days`. `marketId = dayId * 5 + slot`.

## 4. Functions

| Function | Caller | Rules (revert) | Effect |
| --- | --- | --- | --- |
| `registerPlayer(wallet, referrer)` / `registerPlayers(w[], r[])` | OPERATOR | not zero (`ZeroAddress`), not registered (`AlreadyRegistered`), not a bound play key (`AddressIsPlayKey`); referrer 0 or: not self, registered, not frozen, no two way link (`BadReferrer`); batch: equal lengths (`LengthMismatch`), at most 200 (`BatchTooLarge`), all or nothing | player registered with `registeredAt = now`; referrer linked, `referralStats.count += 1` |
| `setReferrer(player, referrer)` / `setReferrers` | OPERATOR | registered (`NotRegistered`), no referrer yet (`ReferrerAlreadySet`), `now < registeredAt + 24 h` (`InviteWindowClosed`), referrer rules as above | link set once, never changes; if the player's first full day is already done, the welcome bonus is paid now (once) |
| `setFrozen(wallet, frozen, reason)` / `setFrozenMany` | OPERATOR | registered; batch rules | flag set, `PlayerFrozen`; balances untouched |
| `setPlayKey(key, expiresAt)` | the player's wallet | registered, not frozen; key not 0, not the caller, not a registered player (`BadPlayKey`); key unbound or bound to the caller (`PlayKeyTaken`); `now < expiresAt <= now + 90 days` (`BadExpiry`) | unbinds the previous key (`PlayKeyRevoked`), binds the new one (`PlayKeySet`); same key renews |
| `revokePlayKey()` | player or its key (expired included) | a key bound (`NoPlayKey`) | both links cleared |
| `createDay(dayId, MarketInput[5])` | OPERATOR | before the open (`BadTimes`), not created (`DayExists`), every `closesAt == open + 1 day` (all five close at the day's end), `closesAt + minResolveGap <= resolvesAt <= open + 2 days` (`BadTimes`), hash not 0 (`EmptyContentHash`) | 5 markets, `DayCreated` |
| `predict(marketId, choice)` | player wallet or its unexpired key | not paused; a key that is bound but expired (`BadPlayKey`); registered, not frozen; choice 1 or 2 (`BadChoice`); market exists and `now >= open` (`DayNotOpen`); `now < closesAt` (`MarketClosed`); slot unanswered (`AlreadyPredicted(id)`) | choice stored for the player; fifth answer: completion credit, invite bonus, welcome once |
| `setOutcome(id, o)` | OPERATOR | market exists (`UnknownMarket`), o in 1..3 (`BadChoice`), not set (`AlreadyResolved`), `now >= resolvesAt` (`NotResolvable`), `now < dayEnd + 48 h` (`ResolveDeadlinePassed`) | outcome, `resolvedAt = now`, `settlesAt = now + settleDelay` |
| `correctOutcome(id, o)` | OPERATOR | set (`NotResolvable`), `now < settlesAt` (`CorrectionWindowOver`), different (`SameOutcome`) | outcome replaced; `settlesAt` unchanged |
| `voidMarket(id, reason)` | OPERATOR | not void (`AlreadyResolved`); unresolved or `now < settlesAt` (`CorrectionWindowOver`) | outcome 3, `settlesAt = now` (final at once) |
| `voidExpired(id)` | anyone | unresolved (`AlreadyResolved`), `now >= dayEnd + 48 h` (`NotExpired`) | outcome 3, reason "expired" |
| `setCorrectedOutcome(id, o)` | OWNER | o is 1 or 2 (`BadChoice`), resolved and `now >= settlesAt` (`TooEarly`), not yet set (`AlreadyResolved`), differs from the outcome (`SameOutcome`) | enables `compensate` |
| `settle(user, dayId)` | anyone | something ready (`NotReadyToSettle`), not everything settled (`AlreadySettled`) | each answered slot whose market is final and past `settlesAt` is added to `settledMask`; hits x `hitPoints` credited (kind 2) in the week of `dayId` |
| `settleMany(users[], dayId)` | anyone | at most 200; skips users with nothing ready; reverts `NotReadyToSettle` if nobody settled | returns the count |
| `compensate(id, users[])` | OPERATOR | at most 500; `correctedOutcome` set (`NothingToCompensate`); skips users not settled on the slot, with another choice, or already compensated; reverts if nobody qualified | `hitPoints` each (kind 3), ranked in the question's week while that week's airdrop is not done, else in the current week |
| `convert(points)` | registered, not frozen | not paused; `points >= minConvertPoints` (`BelowMinimum`), multiple of `pointsPerCT` (`NotMultipleOfRate`), `now >= registeredAt + minAccountAge` (`AccountTooNew`), balance (`InsufficientPoints`), per user and global daily CT caps (`DailyCapReached(left)`), reserve (`InsufficientReserve`) | burns, pays `points * 1e18 / pointsPerCT` CT |
| `airdrop(weekId, winners[], pool)` | OPERATOR | `now >= weekEnd + airdropDelay` (`WeekNotOver`), once (`AirdropDone`), 1 to 10 winners (`BadWinners`), `pool <= maxWeeklyPool` (`PoolTooLarge`); each winner registered (`NotRegistered`), not frozen (`Frozen`), points > 0 and strictly ordered (`BadWinners`); reserve (`InsufficientReserve`) | `pool * splitBps[i] / 10000` to rank i; unpaid ranks stay |
| `proposeParams(p)` / `applyParams()` / `cancelParams()` | OWNER | bounds (`ParamOutOfBounds(i)`); apply after 48 h (`TooEarly`); pending required (`NoPendingParams`) | a new proposal replaces the pending one and restarts the delay |
| `pause()` / `unpause()` | PAUSER / OWNER | | pauses `predict` and `convert` only |
| `withdrawReserve(amount, to)` | OWNER | `to == treasury` (`NotTreasury`), not 0 (`ZeroAmount`), reserve (`InsufficientReserve`) | CT to the treasury |

Views: `name`, `symbol`, `decimals`, `allowance`, `params()`, `pendingParams()`, `currentDay`, `weekOf`, `weekEnd`, `reserve`, `previewConvert`, `dayOf`, `pendingHits` (points of resolved but unsettled hits, latest settle time among those markets), `playerOf(key)`, `referrerOf`, `referralPointsOf`, `referredCount`, and the public mappings `markets`, `userDays`, `players`, `referralStats`, `playKeyOf`, `playerOfKey`, `weekPoints`, `airdropDone`, `compensated`, `convertedCtOnDay`, `convertedCtTotalOnDay`, `pendingApplyAfter`.

## 5. Roles

| Role | Can |
| --- | --- |
| OWNER (`DEFAULT_ADMIN_ROLE`, the master wallet) | grant and revoke roles, propose, apply and cancel parameters, unpause, `setCorrectedOutcome`, `withdrawReserve` to the treasury; owner transfer waits 3 days |
| OPERATOR | register, link inviters (24 h window), freeze and unfreeze, create days, set, correct and void outcomes, compensate, airdrop |
| PAUSER (operator and owner) | pause |
| Play key | `predict` for its player and `revokePlayKey`; every other function sees an unregistered address |

## 6. Parameters (all behind the 48 hour propose and apply delay)

| Index | Field | Default | Bounds |
| --- | --- | --- | --- |
| 0 | `completionPoints` | 100 | 0 to 1,000 |
| 1 | `hitPoints` | 50 | 0 to 1,000 |
| 2 | `referralBps` | 1,000 | 0 to 2,000 |
| 3 | `welcomePoints` | 100 | 0 to 1,000 |
| 4 | `settleDelay` | 6 h | 0 to 48 h |
| 5 | `pointsPerCT` | 1,000 | 100 to 100,000 |
| 6 | `minConvertPoints` | 1,000 | `pointsPerCT` to 1,000,000 |
| 7 | `maxConvertCtPerUserPerDay` | 50 CT | 1 to 10,000 CT |
| 8 | `maxConvertCtPerDay` | 20,000 CT | 100 to 1,000,000 CT |
| 9 | `minAccountAge` | 7 days | 0 to 30 days |
| 10 | `minResolveGap` | 1 h | 0 to 7 days |
| 11 | `maxWeeklyPool` | 10,000 CT | 0 to 1,000,000 CT |
| 12 | `airdropDelay` | 60 h | `48 h + settleDelay` to 7 days |
| 13 | `treasury` | set at deploy | not zero |
| 14 | `splitBps[10]` | 3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300 | non increasing, sum 10,000 |

Constants: `RESOLVE_DEADLINE` 48 h (counted from the day's end, which is every market's close), `MAX_PLAY_KEY_TTL` 90 days, `PARAM_DELAY` 48 h, `INVITE_WINDOW` 24 h, batch caps 200 (500 for `compensate`), 10 winners.

## 7. Events

`Transfer`, `PlayerRegistered`, `PlayerFrozen`, `PlayKeySet`, `PlayKeyRevoked`, `DayCreated`, `Predicted` (user is always the player), `PointsCredited` (kinds 1 completion, 2 hits, 3 compensation), `ReferrerSet`, `ReferralPaid`, `ReferralSkipped` (inviter on hold: bonus not minted, never owed), `WelcomePaid`, `OutcomeSet` (correction flag), `MarketVoided`, `Settled`, `CorrectedOutcomeSet`, `Compensated`, `Converted`, `AirdropPaid`, `ParamsProposed`, `ParamsApplied`, `ParamsCancelled`, `ReserveWithdrawn`, plus the OpenZeppelin role and pause events.

## 8. Invariants (tested)

The 13 invariants of DEV-PLAN 3.4 and 3.9 hold, with two restated by later decisions. Invariant 10: a referrer is set at most once, never to the player, never to a player whose own referrer is this player, and only at registration or within 24 hours of it. Invariant 13: each player receives the welcome bonus at most once, only with a referrer, at the first completed day or at a late link made after that day, never while the inviter is frozen, and it earns the referrer nothing. Invariant 11 holds with the compensation week rule: the week of every ranked credit is the `weekId` in its `PointsCredited` event. Each is an explicit unit test, and the randomized sequence test (`test/platform/CojamPredict.fuzz.test.js`) runs a JavaScript model of the contract against the chain and checks after every step: supply equals the sum of balances and the model; every mint in a transaction is explained by `PointsCredited`, `ReferralPaid` and `WelcomePaid` in that transaction and no `Transfer` moves points between holders; completion at most once per user and day; welcome at most once and only with a referrer; `ReferralPaid` and `ReferralSkipped` only for the player's linked referrer, skipped only while the inviter is frozen; `referralStats` equals the sum of `ReferralPaid`; weekly points equal the sum of `PointsCredited` of that week; the CT reserve equals funded minus conversions and airdrops; play key links are mutual and a key is never a player; user days, markets and players match the model; a final outcome never changes.

## 9. Measured gas (Hardhat EVM, total per transaction including 21,000 intrinsic)

| Call | Gas | Plan estimate |
| --- | --- | --- |
| `predict` by play key, first of the day | 58,975 | about 74,000 |
| `predict` by play key, second to fourth | 41,875 | about 55,000 |
| `predict` fifth, later day, no inviter | 65,405 | 80,000 to 95,000 |
| `predict` fifth, later day, invited (bonus) | 80,582 | 95,000 to 110,000 |
| `predict` fifth, first completed day of the player, no inviter | 100,380 | 80,000 to 95,000 |
| `predict` fifth, invited, first completed day (bonus and welcome) | 123,045 | 101,000 to 116,000 |
| `predict` fifth, the very first credit of the contract (once ever) | 119,858 | |
| `setPlayKey` first / renew | 74,002 / 37,083 | about 85,000 |
| `settleMany` per user, no hits (batch of 50) | 12,260 | about 30,000 |
| `settleMany` per user, 5 hits, half invited (batch of 50) | 34,694 | 30,000 to 45,000 |
| `settle` single user, 5 hits | 72,610 | |
| `compensate` per user (batch of 50, half invited) | 49,901 | |
| `convert` (first of the day for the user and globally, first CT to the user) | 124,768 | about 95,000 |
| `airdrop` 10 winners (10 first time CT holders) | 406,096 | |
| `createDay` | 272,070 | |
| `registerPlayer` / with inviter | 50,417 / 60,610 | |
| `setOutcome` | 34,788 | |

The first credit of a player in a week writes two new slots (balance on the first ever credit, `weekPoints` on the first credit of each week), which is why the first completed day and the first completion of each week cost more than the plan's estimate; the heaviest `predict` stays under the fee payer cap of 150,000. Kaia adds about 10,000 for fee delegated types and prices calldata differently.

## 10. Details the plan left open, and deviations

1. **Linked library** (deviation in form, not in behaviour): the full feature set compiled to 28,047 bytes. Parameter checks, day creation, airdrop checks, `pendingHits` and parameter copies moved to `PredictLogic`. Deploy scripts must link it.
2. **`settlesAt` snapshot**: the market stores `settlesAt = resolvedAt + settleDelay` at resolution, so a later `settleDelay` change never reopens or shortens a running correction window (invariant 5 cannot be broken by a parameter change). Market timestamps are `uint40` instead of `uint64` so the extra field fits slot 1.
3. **Void is final at once**: `voidMarket` and `voidExpired` set `settlesAt = now`, so a void can no longer be corrected; the compensation path still applies (`setCorrectedOutcome` to A or B). `voidMarket` may run before `resolvesAt`; a void is not "an outcome set early".
4. **Voided markets still accept answers** until they close, so a day stays completable; they settle without a hit.
5. **Settle counts answered slots only**: unanswered slots are never marked in `settledMask`.
6. **Correction keeps the settle time and may run after the resolve deadline** as long as it is inside the window.
7. **Corrected outcome**: once per market, only A or B, only different from the stored outcome. **Compensation** skips ineligible users and reverts only when nobody qualified.
8. **Expired key**: `predict` from a key whose binding has expired reverts `BadPlayKey` (not `NotRegistered`), so the fee payer can map it to `PLAY_KEY_INVALID`. An expired key stays reserved to its player until replaced or revoked; it may still revoke itself.
9. **Batches** for registration, inviters and freezes are all or nothing; `settleMany` and `compensate` skip.
10. **Airdrop**: at least one winner, every winner must have points in the week; a pool of 0 is allowed and marks the week done. Strict order implies no duplicates.
11. **`splitBps` must be non increasing** (extra bound, so rank 1 never gets less than rank 2).
12. **Daily caps** are stored in whole CT; counters in base units.
13. **Added errors**: `AlreadyRegistered`, `EmptyContentHash`, `UnknownMarket`, `SameOutcome`, `InsufficientPoints`, `NoPendingParams`, `ZeroAmount`, `NotTreasury`, `LengthMismatch`, `AddressIsPlayKey`, `DecimalsMismatch`. Added event `ParamsCancelled`.
14. **Invite window (DECISIONS "Invite code entry", replaces the plan's first completed day rule)**: `setReferrer` works within 24 hours of `registeredAt`. The 10% stream starts from the link (no back pay). **Late code welcome (DECISIONS "Welcome bonus with a late code")**: a link made before the first full day pays the welcome at that day; a link made after it pays the welcome inside `setReferrer` at once (`WelcomePaid` with the current day id), so the player is not made to wait a second full day.
15. **Inviter on hold (DECISIONS "On hold: staking and invites")**: the bonus is not minted while the inviter is frozen and is never owed later; `ReferralSkipped` records it. Bonus already minted stays. A frozen inviter cannot be newly linked. The welcome bonus is not paid when the inviter is frozen at the friend's first completed day (plan 3.9).
16. **Ranking (DECISIONS "On hold: ranking")**: leaving accounts on hold out of the prize ranks is done by the server when it builds the list; on chain, `airdrop` refuses a frozen winner (`Frozen`), so the operator must submit the list with frozen accounts removed and the next players moved up. The order check compares adjacent submitted winners only, so a list that skips a frozen account still verifies.
17. **Frozen player and play keys**: `revokePlayKey` works while frozen.
18. **Question timing (DECISIONS "Question timing")**: `MarketInput` keeps a per market `closesAt` (so the ABI and storage stay as planned), but `createDay` requires every close to equal the day's end (09:00 KST the next day). The 48 hour rule therefore runs from that common close. `resolvesAt` stays per market, between close plus `minResolveGap` and 24 hours after the close.
19. **Compensation week (DECISIONS "Compensation points")**: weekly points are on chain, so `compensate` implements the rule itself: the question's week when `airdropDone[week]` is false, else the week of the current day. `PointsCredited` carries both `weekId` and `dayId`. Hit credits from `settle` always use the question's week, as the plan says; a settle that runs after the week's airdrop still adds to that past week (the airdrop delay is sized so this does not happen when the keeper runs on time).

## 11. Self review: risks, ranked

1. **Owner key is one EOA** (high impact, by decision). It can drain the reserve to the treasury and, after 48 h, change every parameter (including the treasury). Mitigations are the delay, events and off chain alerts. The owner cannot move points or touch user balances.
2. **Operator key leak** (medium). It can register sybils, link inviters inside the 24 h window (each late link after a full day mints one welcome bonus at once), freeze everyone, set wrong outcomes (bounded to points, correctable inside the window), void markets, and run each week's airdrop up to `maxWeeklyPool` to registered players with on chain points, ordered correctly but possibly skipping honest top players by freezing them first. Rotation by the owner. A leaked key cannot touch conversions caps or the reserve directly.
3. **Airdrop completeness is not provable on chain** (medium, accepted by the plan): the contract checks order and eligibility of the submitted list, not that nobody outside it scored more. Needs the published ranking and monitoring.
4. **Play key squatting** (low to medium): a registered player may bind any address as its key, which blocks that address from ever being registered (`AddressIsPlayKey`) until the squatter revokes. Privy wallets are created at login and registered right after, so the window is short, but a front running squatter could block one wallet. Possible fix before audit: require a signature from the key in `setPlayKey`, or let the operator unbind a key that targets an unregistered wallet.
5. **Conversion farming** (medium, economic): bounded by registration, 7 day age, per user and global caps, freezes; sybil cost is off chain (section 5).
6. **Linked library deployment** (low): a wrong library address at link time would brick the contract; deployment scripts must deploy and verify `PredictLogic` first. The library is stateless and immutable.
7. **Settle timing affects tie breaks** (low): `lastCreditAt` of hit credits is the settle time chosen by the keeper, not the player's action time. Running `settleMany` for all players of a market in one batch keeps it fair; ties at equal points then fall to the address order.
8. **Late corrections after the airdrop** (low): compensation can add week points after the week's airdrop ran; the airdrop is not redone.
9. **Code size margin** (low): 521 bytes below the limit; further features must move into the library.
10. **Not done here**: Slither, an external audit, fork tests against mainnet CT, Kairos gas measurements.
