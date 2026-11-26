# CojamStaking: specification as built

Source: `contracts/contracts/platform/CojamStaking.sol` (interface, events and errors in `contracts/contracts/platform/interfaces/ICojamStaking.sol`). Built to `docs/platform/DEV-PLAN.md` draft 3, sections 3.5 to 3.8 and 8, with the rate table and minimums of `docs/platform/PLAN-SOURCE.md` and the staking rows of `docs/platform/DECISIONS.md` (REVIEW B8, B9). Solidity 0.8.28, optimizer 200, EVM paris, OpenZeppelin 5.4.

## 1. What it does

A holder stakes CT for 30, 90, 180 or 365 days. The annual rate comes from a table indexed by the lock and by the tier of the position's own amount, and is copied into the position when it opens. Interest is simple, accrues per second from `start` to `end` and then stops. Interest can be claimed while the lock runs (at least `minClaim` per claim) and in any amount after it. `withdraw` after the lock pays the principal plus all remaining interest. There is no early exit, no renewal and no freeze: a player frozen in `CojamPredict` can still claim and withdraw here, paying their own gas.

Every position's full interest for its lock (`maxInterest`) is reserved out of the reward CT the contract holds at the moment the position opens, so the contract never promises interest it does not hold.

Immutable: no proxy, no upgrade, no rescue function. CT sent here directly becomes reward CT; any other token sent here is stuck forever.

## 2. Storage and maths

```
Position (two slots): principal uint128, maxInterest uint128 | claimed uint128, start uint40, end uint40, aprBps uint32, lockIndex uint8, closed bool
YEAR = 365 days, BPS = 10,000
earned(p, t) = principal x aprBps x (min(t, end) - start) / (BPS x YEAR)      rounded down, always from start
claimable(p) = earned(p, now) - claimed                                       (0 once closed)
maxInterest  = principal x aprBps x lockDuration / (BPS x YEAR)                identical to earned(p, end)
```

Because `earned` is always computed from `start`, any sequence of claims pays exactly `earned(t)` in total at every time `t` and never more than `maxInterest`; the tests check this to the wei. Because `maxInterest` and `earned(end)` are the same expression, `withdraw` releases the whole reservation with no rounding dust.

Default rate table, basis points (`rateBps[lockIndex][tier]`):

| Lock | Tier 0: under 1,000 CT | Tier 1: 1,000 to 9,999.99... CT | Tier 2: 10,000 CT and more |
| --- | --- | --- | --- |
| 30 days (index 0) | 800 | 900 | 1000 |
| 90 days (index 1) | 1200 | 1300 | 1400 |
| 180 days (index 2) | 1800 | 1900 | 2000 |
| 365 days (index 3) | 2500 | 2600 | 2700 |

Plan check: 1,000 CT for 90 days at 13% gives 32.054794520547945205 CT.

## 3. Functions

| Function | Caller | Rules |
| --- | --- | --- |
| `stake(amount, lockIndex) returns (id)` | anyone, not paused, `nonReentrant` | `lockIndex < 4`; `amount >= minStake`; open positions below `maxOpenPositions`; pulls with `safeTransferFrom` and measures what arrived (`NothingReceived`, `ReceivedMoreThanSent`); the measured principal must again be `>= minStake`, must fit `maxTotalPrincipal` (when not 0) and sets the tier; reverts `InsufficientRewards(available, needed)` when the interest cannot be reserved. `id` is the index in the caller's list |
| `claimInterest(id) returns (amount)` | position owner (the caller's own list), never paused | not closed; `amount = claimable > 0`; while locked `amount >= minClaim`, after the lock any amount |
| `withdraw(id) returns (principal, interest)` | position owner, never paused | not closed; `now >= end`; pays principal plus `maxInterest - claimed`, closes the position, frees an open slot |
| `setRates(uint32[3][4])` | OWNER | each cell 0 to 5,000 bps; new positions only |
| `setTiers(uint256[2])` | OWNER | `0 < low < high <= 100,000,000 CT`; new positions only |
| `setMinimums(minStake, minClaim)` | OWNER | `minStake` 1 to 100,000 CT (new positions); `minClaim` 0 to 1,000 CT (read at claim time, see 7) |
| `setCaps(maxOpenPositions, maxTotalPrincipal)` | OWNER | `maxOpenPositions` 1 to 20; `maxTotalPrincipal` any value, 0 = no cap; both checked by `stake` only |
| `withdrawRewards(amount, to)` | OWNER, `nonReentrant` | `to == treasury`; `0 < amount <= availableRewards()` |
| `proposeTreasury(addr)`, `applyTreasury()`, `cancelTreasury()` | OWNER | apply only 48 hours after the proposal; a new proposal restarts the delay |
| `pause()` | PAUSER | stops `stake` only |
| `unpause()` | OWNER | |
| OZ `beginDefaultAdminTransfer` and the rest of `AccessControlDefaultAdminRules` | OWNER | owner transfer waits 3 days; `PAUSER_ROLE` is granted and revoked by the owner |

Views: `availableRewards()` (`balance - totalPrincipal - totalCommitted`, 0 if that were ever negative), `claimable(user, id)`, `quote(amount, lockIndex) -> (tier, aprBps, interest, end)` (no minimum, cap or reserve check), `positionsOf(user, offset, limit) -> (PositionView[], total)`, `positionOf(user, id)`, `positionCount(user)`, `tierOf(amount)`, `lockDays(i)`, `lockDuration(i)`, `rates()`, the public parameters, `openPositions(user)`, `totalPrincipal`, `totalCommitted`, `totalInterestPaid`, `totalRewardsWithdrawn`, `treasury`, `pendingTreasury`, `pendingTreasuryEta`.

## 4. Roles

| Role | Holder at deploy | Can | Cannot |
| --- | --- | --- | --- |
| OWNER (`DEFAULT_ADMIN_ROLE`, `AccessControlDefaultAdminRules`, 3 day transfer delay) | constructor `owner_` (the master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`) | set rates, tiers, minimums, caps; withdraw available rewards to the treasury; change the treasury after 48 h; unpause; grant and revoke `PAUSER_ROLE` | touch principal or committed interest; change an open position's rate, tier, end or reserved interest; pause claims or withdrawals |
| PAUSER (`PAUSER_ROLE`) | the owner, plus constructor `pauser` (the operator key; zero for none) | pause `stake` | unpause, anything else |

## 5. Events and errors

Events: `Staked(user, id, amount, lockDays, aprBps, end, maxInterest)`, `InterestClaimed(user, id, amount)`, `Withdrawn(user, id, principal, interest)`, `RatesSet(rates)`, `TiersSet(thresholds)`, `MinimumsSet(minStake, minClaim)`, `CapsSet(maxOpenPositions, maxTotalPrincipal)`, `RewardsWithdrawn(to, amount)`, `TreasuryProposed(treasury, eta)`, `TreasuryProposalCancelled(treasury)`, `TreasurySet(previous, treasury)`, plus OZ `Paused`, `Unpaused` and the role events. The constructor emits `RatesSet`, `TiersSet`, `MinimumsSet`, `CapsSet` and `TreasurySet` so the indexer starts from events alone.

Errors: `ZeroAddress`, `DecimalsMismatch`, `ZeroAmount`, `InvalidLock(i)`, `BelowMinStake(amount, min)`, `TooManyPositions(open, max)`, `TotalCapReached(room, amount)`, `InsufficientRewards(available, needed)`, `NothingReceived`, `ReceivedMoreThanSent`, `UnknownPosition(id)`, `PositionClosed(id)`, `NothingToClaim`, `BelowMinClaim(amount, min)`, `LockNotEnded(end)`, `NotTreasury(to)`, `RateOutOfBounds(lock, tier, bps)`, `TiersOutOfBounds(low, high)`, `MinStakeOutOfBounds`, `MinClaimOutOfBounds`, `MaxOpenPositionsOutOfBounds`, `NoTreasuryProposal`, `TreasuryDelayNotPassed(eta)`, plus OZ `EnforcedPause`, `ExpectedPause`, `AccessControlUnauthorizedAccount`, `ReentrancyGuardReentrantCall` and the admin rules errors.

## 6. Invariants (all tested)

1. `CT.balanceOf(this) >= totalPrincipal + totalCommitted` after every step (randomized sequence test, checked after each of hundreds of steps per run and during the final wind down).
2. A position pays at most `principal + maxInterest`, and exactly that in total once withdrawn.
3. Principal goes only to its owner and only at or after `end`.
4. No owner path reaches principal or committed interest: after every owner lever is pulled, `withdrawRewards(1)` still reverts and every position pays in full.
5. Rate, tier, minimum stake and cap changes never alter an open position.
6. `pause` blocks `stake` only.
7. `totalCommitted` equals the sum of `maxInterest - claimed` over open positions; `totalPrincipal` equals the sum of open principals (model checked).

## 7. Decisions on details the plan left open, and deviations

1. **Position layout.** The plan's struct (`uint64` start and end) needs three slots despite its "two slots" comment. Built with `uint40` timestamps (good for about 34,000 years) and a `lockIndex` byte, which fits two slots exactly. All casts use `SafeCast`.
2. **Lock days are fixed.** The plan shows `uint16[4] public lockDays` in storage but lists no setter, so they are a pure function (`lockDays(i)`: 30, 90, 180, 365). The duration goes through an internal virtual `_lockDuration` only so the test build `mocks/StakingShortLock.sol` (days of N seconds, for the Kairos full cycle E2E the plan asks for) can reuse the exact maths. Mainnet must deploy `CojamStaking` itself; Sourcify verification shows which.
3. **Treasury.** DEV-PLAN 3.6 lists `treasury` for both contracts with a 48 hour delay. Built as `proposeTreasury` / `applyTreasury` / `cancelTreasury` with `TREASURY_DELAY = 48 hours`; set at deploy. `withdrawRewards` keeps the plan's `to` argument and requires `to == treasury`, so the signer sees the destination.
4. **Pause roles.** `pause` needs `PAUSER_ROLE`; the owner is granted it at deploy (3.7 lists the master wallet as a pauser) and the constructor can grant a second pauser (the operator key). `unpause` is owner only.
5. **Bounds the plan did not give.** Rates have no lower bound (0 is allowed and makes zero interest positions that need no reserve). Tiers: `0 < low < high <= 100,000,000 CT`. `maxOpenPositions` 1 to 20, so the decided 20 stays the ceiling. `maxTotalPrincipal` is unbounded and may be set below the current total, which only stops new stakes.
6. **`minClaim` is global, not snapshotted.** It is read at claim time. Snapshotting it would need a third slot (about 20,000 more gas per stake). Its effect on an open position is limited to timing: a raised minimum can delay locked claims until `end`, but after the lock every unit is claimable and `withdraw` pays everything. The plan's phrase "affect new positions only" holds exactly for rates, tiers, `minStake` and the caps.
7. **Measured principal decides everything.** `stake` checks `minStake` on the requested amount before the pull (cheap early revert) and again on the measured amount after it; the tier, the total cap and the reserve check use the measured amount. The reserve check runs after the pull, with the new principal already added to `totalPrincipal`, so the incoming principal can never count as reward CT. A revert there undoes the pull.
8. **No dust on withdraw.** The plan expected `withdraw` to release rounding dust (`maxInterest - earned`). With `maxInterest` defined as `earned(end)` the dust is always 0; `withdraw` pays `maxInterest - claimed` and releases exactly that.
9. **Extra surface.** Events `TiersSet`, `MinimumsSet`, `CapsSet` and the three treasury events, the constructor's start events, the counters `totalInterestPaid` and `totalRewardsWithdrawn`, the views `positionOf`, `positionCount`, `tierOf`, `lockDuration`, `rates()`, and a richer `PositionView` (id, claimable and lock index included) for the API (`GET /v1/staking/positions`).
10. **Deploy guards.** The constructor refuses a zero token, owner or treasury and a token without 18 decimals (tier thresholds are in 18 decimal units).
11. **`availableRewards` saturates at 0** instead of reverting if the balance were ever below the obligations (impossible with a plain ERC-20; it keeps the views and `stake`'s error readable if CT ever misbehaved).
12. **Zero amounts.** A claim of 0 reverts `NothingToClaim` (also after the lock); `withdrawRewards(0)` reverts `ZeroAmount`.

## 8. Measured gas (Hardhat, `test/platform/CojamStaking.gas.test.js`)

| Call | Gas | Fee payer cap (DEV-PLAN 6.3) |
| --- | --- | --- |
| `stake`, first position in the contract | 199,415 | 300,000 |
| `stake`, a user's first position | 165,202 | 300,000 |
| `stake`, a later position (up to the 20th) | 128,768 to 131,002 | 300,000 |
| `claimInterest`, first claim while locked | 82,597 | 200,000 |
| `claimInterest`, later claim or after the lock | 63,537 to 65,497 | 200,000 |
| `withdraw` | 68,126 to 72,938 | 200,000 |
| `withdrawRewards` | 74,023 to 91,111 | owner paid |
| `setRates` / `setTiers` / `setMinimums` / `setCaps` | about 55,000 to 69,000 / 36,000 / 28,000 to 53,000 / 28,000 to 53,000 | owner paid |
| Deployment | about 3,276,000 | |

The gas test fails if any of the three holder calls reaches the fee payer cap.

## 9. Tests

`contracts/test/platform/CojamStaking.test.js` (functions, every revert, roles, pause, treasury, measured pull with a fee on transfer token, inflating and lying tokens, reentrancy with a malicious token, short lock build), `CojamStaking.math.test.js` (all 12 rate cells against hand computed values, the plan's 32.05 CT example, tier boundaries, per second accrual at 22 offsets including one second before, at and after the end, no drift under 80 random claims and under a claim every second, the minimum claim rule), `CojamStaking.fuzz.test.js` (randomized sequences against a JavaScript model: stakes, claims, withdrawals, rate, tier, minimum and cap changes, reward funding and withdrawals, pause, time jumps; solvency and model totals after every step; every revert is the one the model predicts; `STAKING_FUZZ_RUNS` x `STAKING_FUZZ_STEPS`, default 3 x 300), `CojamStaking.gas.test.js`. Helpers in `stakingHelpers.js`. Mocks: `StakingMockCT`, `StakingFeeToken`, `StakingEvilToken`, `StakingShortLock`.

Coverage of `CojamStaking.sol` (solidity-coverage): 32 of 32 functions, 113 of 113 statements, 123 of 124 branches. The one branch left is the reentrancy guard of `withdrawRewards` itself, which only the owner could reach (the guard is checked after the role); re-entry into `stake` from inside `withdrawRewards` is tested.

Run: `npx hardhat test test/platform/CojamStaking*.js`; gas figures with `STAKING_GAS_LOG=1`, or `REPORT_GAS=true` for the reporter table.

## 10. Self review: risks, ranked

1. **Owner key is one EOA (high impact, accepted by the founder).** A thief of the master wallet key can take every unowed reward CT at once (the treasury is the master wallet itself, so the 48 hour treasury delay does not help in that case), set all rates to 0 and pause new stakes. It cannot reach principal or committed interest, and open positions keep paying. Mitigation outside the contract: keep `availableRewards` small (fund in tranches), owner activity alert (DEV-PLAN 6.6), a multisig if the founder changes the decision.
2. **Reserve crowding (medium).** There is no maximum per position. One large 365 day stake reserves up to 27% of its size (50% at the rate ceiling) and can use up the reward reserve, so everyone else sees "staking is full for now" until the owner funds more. It costs the staker their own capital locked for the full term, so it is griefing, not theft. Mitigation: set `maxTotalPrincipal` at launch to match the funded reserve, and watch `availableRewards`.
3. **No early exit and no successor import (medium, by decision).** Principal is locked to `end` whatever happens to the platform; a later contract cannot move old positions. This is the decided design (REVIEW B8, DEV-PLAN 3.8) and the reason the owner has no reach into principal.
4. **Token assumptions (low for CT).** Solvency assumes the balance only changes through this contract's transfers and incoming transfers. CT is a fixed supply plain ERC-20 with no hooks, fees, rebase or blacklist, so this holds. A fee token would still be solvent (tested); a negatively rebasing token would not, which is why the contract binds to one immutable CT.
5. **`minClaim` is read at claim time (low).** The owner can raise it up to 1,000 CT and so delay locked claims of small positions until their end; nothing earned is lost (see 7.6).
6. **The test build hook (low).** `_lockDuration` is virtual for `StakingShortLock`. A deploy of the mock instead of `CojamStaking` on mainnet would give short locks; the deploy script and Sourcify verification must name `CojamStaking`.
7. **Owner renounce (low).** `AccessControlDefaultAdminRules` lets the owner renounce after the delay. Users are unaffected, but unowed rewards and parameters would be frozen for good.
8. **Unbounded position history (low).** A user's list keeps closed positions; writes are O(1) and `positionsOf` pages, so only off chain readers see the growth. At most 20 are open at once.
9. **Rounding (negligible).** `earned` rounds down, so a holder can lose under 1 wei of interest per claim relative to exact arithmetic; the total paid is never above `maxInterest`.

Open for the founder, from the plan: reward funding amounts, a paid external audit before mainnet (DEV-PLAN section 11, item 2: at least for this contract), and whether to sponsor gas for frozen players' claims and withdrawals (off chain only; the contract already lets them act).
