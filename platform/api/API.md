# cojam-app-api: endpoints

Base URL: `https://app-api.cojam.app` (mainnet), Kairos beta to be named at deploy, `http://localhost:8080` locally. TypeScript types of every user response: `platform/shared/src/api.ts`. Error codes: `platform/shared/src/errors.ts`.

## Conventions

* JSON in and out. Timestamps are unix seconds. CT and KAIA amounts are base unit strings (18 decimals) in fields ending with `Wei`. Points are plain numbers. Addresses are lower case.
* Day and week ids follow `platform/shared/src/time.ts`: `dayId = unix / 86400` (the day opens 09:00 KST), `weekId = (dayId + 3) / 7` (Monday 09:00 KST), `marketId = dayId * 5 + slot`. Every market of a day closes at the day's end.
* Auth. User endpoints: `Authorization: Bearer <Privy access token>` of the player app. Admin endpoints: a token of the separate admin Privy app (email on `admin_users`), or the operations agent service token. Local only (`AUTH_DEV_BYPASS=1`, impossible in production): `X-Dev-User: <name>` and `X-Dev-Admin: <email>`.
* Optional headers: `X-Device-Id` (a random id the PWA keeps, 8 to 64 of `A-Z a-z 0-9 _ -`; used by the sign up limits), `X-App-Version`.
* CORS: only `ALLOWED_ORIGINS` (`https://app.cojam.app`, `https://admin.cojam.app`).
* Errors: HTTP status plus

```json
{ "error": { "code": "RATE_LIMITED_SENDER", "message": "Daily sponsored transaction limit reached for this player", "retryable": true, "details": { "limit": 10 } } }
```

`retryable: true` means the same request may succeed later unchanged (the outbox retries it, DEV-PLAN 4.7). The PWA shows its own copy per `code`.

---

## Public

### GET /v1/config

Network, contracts, the fee payer, gas limits for 0x31 transactions, contract params and the current day.

```json
{
  "network": "kairos", "chainId": 1001,
  "contracts": { "ct": "0xa8e5…bd9e", "predict": "0xda6f…c40a", "staking": "0x4978…3017" },
  "feePayer": "0x7099…79c8", "privyAppId": "cmwxqqrt0017p0gl5hi2gewh7",
  "minAppVersion": "0.0.0", "supportEmail": "help@cojam.app", "playKeyTtlDays": 30, "maxGasPriceGkei": 50,
  "gasLimits": { "predict": 170000, "setPlayKey": 120000, "revokePlayKey": 80000, "settle": 150000, "convert": 200000, "approve": 100000, "stake": 300000, "claimInterest": 150000, "withdraw": 150000 },
  "params": { "completionPoints": 100, "hitPoints": 50, "referralBps": 1000, "welcomePoints": 100, "pointsPerCT": 1000, "minConvertPoints": 1000, "maxConvertCtPerUserPerDay": 50, "maxConvertCtPerDay": 20000, "minAccountAgeSeconds": 604800, "settleDelaySeconds": 21600, "maxWeeklyPoolCt": 10000, "splitBps": [3000,2000,1500,1000,700,500,400,300,300,300] },
  "staking": null,
  "time": { "now": 1795715734, "dayId": 20783, "dayOpensAt": 1795651200, "dayEndsAt": 1795737600, "weekId": 2969 },
  "features": { "invites": true, "staking": true, "conversion": true, "krwDisplay": false },
  "rpcUrl": "https://public-en-kairos.node.kaia.io", "explorerUrl": "https://kairos.kaiascan.io",
  "krwPerCt": null, "userTxFeeWei": "5000000000000000",
  "maintenance": { "on": false, "message": null, "backAt": null },
  "emailProviders": [ { "domain": "gmail.com", "name": "Gmail" }, { "domain": "naver.com", "name": "Naver" } ],
  "stakingLimits": { "maxOpenPositions": 20, "maxUserPrincipalWei": "1000000000000000000000000", "maxTotalPrincipalWei": "1850000000000000000000000", "paused": false }
}
```

* `rpcUrl`: the public JSON-RPC the PWA reads from (`PUBLIC_RPC_URL`, default the public Kaia endpoint of `NETWORK`; never the API's own provider URL). With `DEV_CHAIN=stub` it is `<this API>/dev/rpc` (below). `explorerUrl`: `EXPLORER_URL`, default kaiascan of the network.
* `krwPerCt`: `KRW_PER_CT` (KRW is shown in Korean only), null when unset. `userTxFeeWei`: `USER_TX_FEE_KAIA` (default 0.005), the estimate shown before a user paid transaction (CT transfer, or a claim or withdrawal while on hold).
* `maintenance`: the `app_state` row `app.maintenance` (`{ "on": true, "message": { "en": "…", "ko": "…" } | "plain text", "backAt": unix seconds | ISO }`), else the env fallback `MAINTENANCE=1`, `MAINTENANCE_MESSAGE`, `MAINTENANCE_BACK_AT`. The admin switch `POST /admin/v1/app` writes the same row (`message` plain text, `endsAt`, read as `backAt` when it is an ISO time or unix seconds).
* `emailProviders`: the enabled allow list (A1 caption and typo help). `stakingLimits`: the staking snapshot, else a live read (60 s cache), else the launch defaults (20 open stakes, 1,000,000 CT per address, 1,850,000 CT in total).

`gasLimits` are the fee payer's caps: put them in the transaction as the gas limit (Kaia charges the gas used, not the limit). `staking` fills once the worker writes its snapshot.

### GET /v1/health (`?strict=1`)

```json
{ "ok": true, "db": true, "rpc": true, "blockNumber": 234100000, "feePayer": { "address": "0x7099…79c8", "balanceWei": "100000000000000000000", "low": false }, "indexer": { "block": 234099998, "lagBlocks": 2 }, "version": "0.1.0" }
```

`strict=1` answers 503 when the RPC is down, the fee payer is under `MIN_FEE_PAYER_BALANCE_KAIA`, or the indexer is more than 30 blocks behind (for the uptime monitor).

### POST /v1/auth/email-check

Called before the PWA asks Privy to send a code. Normalises the address (lower case, `googlemail.com` to `gmail.com`, Gmail dots and plus tags removed, plus tags removed elsewhere) and checks the allow list. Says nothing about whether an account exists.

Request `{ "email": "Min.Ji+promo@gmail.com" }`

```json
{ "allowed": true, "reason": null, "supportedProviders": [ { "domain": "gmail.com", "name": "Gmail" }, { "domain": "naver.com", "name": "Naver" } ] }
```

`reason` when refused: `EMAIL_INVALID` or `EMAIL_DOMAIN_NOT_ALLOWED` (still 200). Limits per hour: 10 per network (`RATE_LIMITED_IP`), 5 per device (`RATE_LIMITED_DEVICE`), 5 per normalised address (`RATE_LIMITED_EMAIL`).

### GET /v1/invite/lookup?code=

For the Gate and A2. Normalises the code (upper case, letters and digits only). 30 per network per hour.

```json
{ "valid": true, "inviterName": "mi*****m" }
```

Unknown, disabled, unregistered or on hold inviters: `{ "valid": false }`.

---

## Session and profile (user)

### POST /v1/session

Login bootstrap. Creates the user, re-checks the verified email from Privy against the allow list and the normalised address, applies the sign up limits (per network 20 a day, flag above 5; per device 2 a day and 3 in total; a global burst only flags), and queues the registration for the worker (sent within about 10 s). Idempotent: later calls return the current state.

Request `{ "inviteCode": "K7M2QXA" }` (optional)

```json
{
  "registration": "pending", "reason": null,
  "wallet": "0x5823…e296", "frozen": false, "playKey": null,
  "invite": { "code": null, "link": null, "linkedTo": { "name": "da****a" }, "canEnterCode": false, "enterCodeUntil": null },
  "inviteResult": { "status": "queued", "code": "K7M2QXA", "inviterName": "da****a" }
}
```

* `registration`: `pending`, `registered` or `refused` with `reason` (`EMAIL_DOMAIN_NOT_ALLOWED`, `EMAIL_INVALID`, `EMAIL_DUPLICATE`, `SIGNUP_RATE_LIMITED`).
* `invite.code` and `link` appear once registered and not on hold.
* `inviteResult.status`: `queued` (rides on the registration), `linked` (already registered: `setReferrer` queued), `rejected` with `error` (an invite error code). A bad code never blocks registration.
* Errors: `UNAUTHORIZED`, `EMAIL_MISSING`, `WALLET_MISSING` (409, retryable: Privy has not created the embedded wallet yet).

### GET /v1/session

Same body without `inviteResult`, for polling during "Setting up your game". While pending it also checks the chain and flips to `registered` when the player is already there. `playKey` once bound: `{ "key": "0xf2e7…5112", "expiresAt": 1798307734, "valid": true }`.

### GET /v1/me

```json
{
  "id": 12, "wallet": "0x5823…e296", "emailDomain": "gmail.com", "displayName": null, "language": "en", "onboarded": false,
  "registration": "registered", "registeredAt": 1795704921, "frozen": false, "supportEmail": "help@cojam.app", "createdAt": 1795704800,
  "stats": { "daysPlayed": 1, "daysCompleted": 1, "predictions": 5, "hits": 2, "hitRate": 0.6667, "pointsAllTime": 215 }
}
```

`NOT_REGISTERED` (403) before the first `POST /v1/session`. Also `"newResults": 3, "resultsSeenAt": 1795700000`: answered markets whose answer was set since the player last opened Results (the tab badge, at most 99; before the first visit, the last 7 days count).

### PATCH /v1/me

Request (any subset) `{ "language": "ko", "displayName": "minji", "onboarded": true, "resultsSeen": true }` (`resultsSeen: true` when Results opens: stores `user_marks.results_seen_at` and resets `newResults`). `displayName` is 2 to 20 characters or `null`. Unknown fields are refused (400). Answers the `GET /v1/me` body.

---

## Play (user)

### GET /v1/today

```json
{
  "dayId": 20783, "opensAt": 1795651200, "endsAt": 1795737600, "nextOpensAt": 1795737600, "weekId": 2969, "published": true,
  "markets": [
    {
      "marketId": 103915, "slot": 0, "category": "crypto",
      "text": {
        "en": { "title": "Will Bitcoin close above $100,000 today?", "left": "No", "right": "Yes", "rule": "Binance BTC/USDT daily close, 00:00 UTC", "settle": "09:00 tomorrow" },
        "ko": { "title": "비트코인, 오늘 10만 달러 위에서 마감할까요?", "left": "아니요", "right": "예", "rule": "바이낸스 BTC/USDT 일봉 종가 (오전 9시)", "settle": "내일 오전 9시" },
        "ja": { "title": "ビットコイン、今日の終値は10万ドルを超える？", "left": "超えない", "right": "超える", "rule": "Binance BTC/USDTの日足終値（午前9時）", "settle": "明日の午前9時" }
      },
      "imageUrl": "https://img.cojam.app/q/20783-0.webp", "thumbUrl": "https://img.cojam.app/q/20783-0.thumb.webp",
      "closesAt": 1795737600, "resolvesAt": 1795741200, "myChoice": null, "pendingChoice": 2
    }
  ],
  "answered": 0, "completed": false, "completion": null
}
```

* `myChoice`: on chain (index, plus a live chain read for indexer lag). `pendingChoice`: a sponsored predict accepted by the node, not yet seen on chain.
* `published: false` with no markets before the day is on chain.
* `completion` after the fifth answer is credited: `{ "points": 100, "welcomePoints": 100, "creditedTx": "0x…" }`.
* `imageUrl` null means the category fallback.
* `inviterName`: the public name of the player's inviter (the welcome note on day done), null without one.

### GET /v1/results?cursor=&limit=

Days the player took part in, newest first, 7 per page (`limit` up to 14). `cursor` is the `nextCursor` of the previous page (a day id).

```json
{
  "summary": {
    "week": { "weekId": 2969, "points": 200, "hits": 2, "answered": 5, "daysPlayed": 1 },
    "allTime": { "points": 200, "hits": 2, "settled": 3, "hitRate": 0.6667 },
    "pendingPoints": 50
  },
  "days": [
    {
      "dayId": 20782, "weekId": 2969, "answered": 5, "completed": true, "completionPoints": 100, "hits": 2,
      "hitPointsCredited": 100, "hitPointsPending": 50, "welcomePoints": 0, "inviteBonus": 15,
      "rows": [
        { "marketId": 103910, "slot": 0, "category": "crypto", "text": { "en": {}, "ko": {}, "ja": {} }, "thumbUrl": null, "myChoice": 1, "outcome": 1, "correctedOutcome": null,
          "result": "hit", "hitPoints": 50, "hitState": "credited", "landsAt": null, "resolvedAt": 1795694000, "evidenceUrl": "https://www.binance.com/…" }
      ]
    }
  ],
  "nextCursor": null
}
```

Each row also has `resolvesAt` (when the answer is expected); `evidenceUrl` is the first evidence link of the deciding resolution run, else the primary source. Each day has `inviteFriends`, the number of friends whose points made that day's invite bonus. `result`: `pending`, `hit`, `miss`, `void`, `unanswered`. `hitState`: `credited` (settled), `pending` (resolved, lands at `landsAt`), `none`. Summary points are prediction points only (the invite bonus has its own line per day).

### GET /v1/markets/:id

One published market with sources and the evidence of the deciding resolution run.

```json
{
  "marketId": 103910, "dayId": 20782, "slot": 0, "category": "crypto", "status": "resolved", "text": { "en": {}, "ko": {}, "ja": {} },
  "imageUrl": null, "closesAt": 1795651200, "resolvesAt": 1795654800,
  "sources": [ { "name": "Binance", "url": "https://www.binance.com/en/trade/ETH_USDT", "role": "primary" } ],
  "outcome": 1, "correctedOutcome": null, "resolvedAt": 1795694000, "settlesAt": 1795715600, "myChoice": 1,
  "evidence": [ { "url": "https://…", "quote": "Close 3,512.40", "observedAt": 1795651260 } ],
  "resolutionSummary": "Both sources show a close above 3,500."
}
```

### GET /v1/ranking/week/:weekId (`current` or a number)

Accounts on hold are left out of the prize ranks (the players below move up). Ties: equal points rank by the earlier last completion that week, then the lower address.

```json
{
  "weekId": 2969, "startsAt": 1795392000, "endsAt": 1795996800, "status": "open",
  "poolWei": "1284000000000000000000", "qualifiedPlayers": 1284, "splitBps": [3000,2000,1500,1000,700,500,400,300,300,300],
  "top": [ { "rank": 1, "name": "da****a", "points": 1400, "prizeWei": "385200000000000000000" } ],
  "me": { "rank": 27, "points": 950, "gapToTenth": 100, "noPrize": false },
  "around": [ { "rank": 26, "name": "so*a", "points": 1000, "prizeWei": null }, { "rank": 27, "name": "0x5823…e296", "points": 950, "prizeWei": null, "me": true } ],
  "tieBreak": "earlier_last_completion"
}
```

On hold: `"me": { "rank": null, "points": 1500, "gapToTenth": null, "noPrize": true }`. Also `"airdropTx"` (the week's airdrop transaction: the caller's own row, else the week's, null before it is sent) and `"lastWeek": { "weekId": 2968, "rank": 4, "prizeWei": "119600000000000000000", "txHash": "0x…" }` (the caller's prize in the week before the one asked for, from the airdrop rows; null without one). `poolWei` is the worker's figure for the week, else an estimate (1 CT per ranked player, capped at `maxWeeklyPool`). `status`: `open`, `closed` (after the week's end), `airdropped`.

---

## Wallet and staking (user)

### GET /v1/wallet

Live chain reads.

```json
{
  "address": "0x5823…e296", "ctWei": "1840500000000000000000", "kaiaWei": "2400000000000000000", "points": 75400, "pendingHitPoints": 50, "stakedWei": "1500000000000000000000",
  "conversion": { "pointsPerCT": 1000, "minConvertPoints": 1000, "maxPointsNow": 50000, "ctPreviewWei": "50000000000000000000",
                  "userCapLeftWei": "50000000000000000000", "globalCapLeftWei": "20000000000000000000000", "allowedFrom": 1796309721, "blockedReason": null },
  "krwPerCt": null
}
```

Also `pendingHitLandsAt` (when the earliest pending hit points land, null with none) and `conversion.paused` (CojamPredict is paused: `maxPointsNow` is 0 for everyone). `blockedReason`: `NOT_REGISTERED`, `FROZEN`, `ACCOUNT_TOO_NEW` (until `allowedFrom`), `DAILY_CAP_REACHED`, `BELOW_MINIMUM`. Errors: `RPC_UNAVAILABLE` (503).

### GET /v1/wallet/history?cursor=&limit=

From the index (deposits and withdrawals of CT, conversions, airdrops, staking).

```json
{ "items": [ { "kind": "conversion", "txHash": "0x…", "at": 1795700000, "amountWei": "1000000000000000000", "points": 1000 },
             { "kind": "deposit", "txHash": "0x…", "at": 1795400000, "amountWei": "2000000000000000000000", "counterparty": "0x7a3f…1c7e" } ],
  "nextCursor": "11-0" }
```

`kind`: `deposit`, `withdrawal`, `conversion`, `airdrop` (with `weekId`, `rank`), `stake`, `interest`, `unstake`.

### GET /v1/staking/quote?amount=&lock=&lang=

`amount` in base units, `lock` in days (30, 90, 180, 365) or a lock index 0 to 3. KRW only for `lang=ko` and only when `KRW_PER_CT` is set.

```json
{
  "amountWei": "1000000000000000000000", "lockIndex": 1, "lockDays": 90, "tier": 1, "aprBps": 1300, "interestWei": "32054794520547945205", "endsAt": 1803491734,
  "krw": { "principal": 200000, "interest": 6411 },
  "capacity": { "userRoomWei": "998500000000000000000000", "totalRoomWei": "1730000000000000000000000", "availableRewardsWei": "480000000000000000000000", "fits": true, "reason": null }
}
```

`capacity.reason`: `BELOW_MIN_STAKE`, `TOO_MANY_POSITIONS`, `STAKING_TOTAL_CAP`, `STAKING_USER_CAP` (1,000,000 CT open principal per address), `STAKING_FULL`, `FROZEN` (an account on hold cannot open stakes).

### GET /v1/staking/positions

```json
{
  "positions": [ { "id": 0, "principalWei": "1000000000000000000000", "lockIndex": 1, "lockDays": 90, "aprBps": 1300, "startsAt": 1793901322, "endsAt": 1801677322,
                   "maxInterestWei": "32054794520547945205", "claimedWei": "0", "claimableWei": "7479501522070015220", "closed": false, "canClaim": false, "canWithdraw": false } ],
  "totals": { "principalWei": "1500000000000000000000", "claimableWei": "10767172754946727548", "open": 2 },
  "minClaimWei": "10000000000000000000"
}
```

`canClaim`: while locked at least `minClaim`, after the lock any amount. `paidWei` on a closed position: principal plus all interest paid over its life (null while open). An account on hold claims and withdraws with its own KAIA (no sponsored gas).

---

## Invites (user)

### GET /v1/invite

```json
{
  "code": "K7M2QXA", "link": "https://app.cojam.app/i/K7M2QXA", "available": true, "referralBps": 1000, "welcomePoints": 100,
  "stats": { "friendsJoined": 3, "friendsFirstDayDone": 2, "bonusLifetime": 145, "bonusThisWeek": 40 },
  "recent": [ { "name": "da****a", "joinedAt": 1795708521, "state": "first_day_done", "bonusPoints": 35 } ],
  "linkedTo": null, "canEnterCode": true, "enterCodeUntil": 1795791321
}
```

On hold: `code`, `link` null and `available: false`.

### POST /v1/invite/redeem

Request `{ "code": "k7m2-qxa", "source": "profile" }` (`source`: `first_run` default, or `profile`). Binds the inviter: on the queued registration, or by a `setReferrer` the worker sends (only within 24 hours of registration). The welcome bonus is still paid (after the first full day, or at once when that day is already done). 10 per player per hour.

```json
{ "status": "linked", "inviterName": "da****a", "chain": "queued" }
```

Errors: `INVITE_SHORT`, `INVITE_UNKNOWN`, `INVITE_OWN`, `INVITE_ALREADY_LINKED` (`details.inviterName`), `INVITE_TOO_LATE`, `INVITE_LIMIT` (inviter daily cap of 30, or a two way link), `FROZEN`, `RATE_LIMITED_USER`.

---

## Transactions (user)

### POST /v1/tx/sponsor

Request `{ "rawTransaction": "0x31f8…" }`: the sender signed `senderTxHashRLP` of a TxTypeFeeDelegatedSmartContractExecution.

```json
{ "txHash": "0x8213…21db", "action": "predict", "from": "0xf2e7…5112", "player": "0x5823…e296", "nonce": 4, "duplicate": false }
```

The answer comes once the node accepted the transaction (not after mining). The same signed transaction posted again returns the first hash with `duplicate: true` and is never broadcast twice.

Auth: a `predict` or `revokePlayKey` sent by a play key bound on chain needs no token. Every other action needs the bearer whose embedded wallet is `from`.

Policy (DEV-PLAN 6.3 as amended):

| Target | Function | Rules | Gas cap |
| --- | --- | --- | --- |
| CojamPredict | `predict(uint256,uint8)` | from is the player's valid play key or the bearer's wallet; market of today and open; choice 1 or 2; not answered (index, then simulation) | 170,000 |
| CojamPredict | `setPlayKey(address,uint64)` | from is the bearer's wallet; key not 0 or the sender; expiry within 31 days; 3 a day | 120,000 |
| CojamPredict | `revokePlayKey()` | the player's key (even expired) or the bearer's wallet | 80,000 |
| CojamPredict | `settle(address,uint32)` | user is the sender | 150,000 |
| CojamPredict | `convert(uint256)` | multiple of `pointsPerCT`, at least `minConvertPoints`, caps and age by simulation | 200,000 |
| CT | `approve(address,uint256)` | spender is CojamStaking | 100,000 |
| CojamStaking | `stake(uint256,uint8)` | lock 0 to 3, at least `minStake` | 300,000 |
| CojamStaking | `claimInterest(uint256)`, `withdraw(uint256)` | ownership by simulation | 150,000 |

Every action: type 0x31, chain id, value 0, one sender signature recovering to `from`, no foreign fee payer, canonical calldata, gas price at most `MAX_GAS_PRICE_GKEI`, the player registered on chain, and **never for an account on hold** (frozen in Postgres or on chain), whatever the action. Never sponsored: CT `transfer` (withdrawal is paid by the user), any owner or operator function, any other contract. Gas caps come from the measured gas in `contracts/docs` plus the Kaia fee delegation surcharge, Kaia calldata pricing and about 20% headroom (`src/feeDelegation/policy.ts`).

Limits (Postgres, safe with several instances): `predict` 10 attempts per player per day, `setPlayKey` 3, other actions 15 (`RATE_LIMITED_SENDER`); the same per Privy user where a token is sent (`RATE_LIMITED_USER`); 300 per network per day (`RATE_LIMITED_IP`); 20 per player per minute (`RATE_LIMITED_BURST`); a global daily budget of 3 x the 7 day average spend, at least `DAILY_BUDGET_KAIA` (`DAILY_BUDGET_EXHAUSTED`); the fee payer balance floor (`FEE_PAYER_BALANCE_LOW`). A refused broadcast releases the counters.

Error codes: shape `DECODE_FAILED`, `TX_TYPE_NOT_ALLOWED`, `SENDER_SIGNATURE_INVALID`, `CHAIN_ID_MISMATCH`, `FEE_PAYER_MISMATCH`, `VALUE_NOT_ZERO`, `TARGET_NOT_ALLOWED`, `SELECTOR_NOT_ALLOWED`, `CALLDATA_INVALID`, `GAS_LIMIT_TOO_HIGH`, `GAS_LIMIT_TOO_LOW`, `GAS_PRICE_TOO_HIGH`, `SPENDER_NOT_ALLOWED`; sender `AUTH_REQUIRED`, `SENDER_NOT_ALLOWED`, `WALLET_MISSING`, `PLAY_KEY_INVALID`; state `FROZEN`, `NOT_REGISTERED`, `ALREADY_DONE`, `MARKET_CLOSED`, `DAY_NOT_OPEN`, `PAUSED`, `BELOW_MINIMUM`, `NOT_MULTIPLE_OF_RATE`, `INSUFFICIENT_POINTS`, `ACCOUNT_TOO_NEW`, `DAILY_CAP_REACHED`, `INSUFFICIENT_RESERVE`, `BELOW_MIN_STAKE`, `TOO_MANY_POSITIONS`, `STAKING_TOTAL_CAP`, `STAKING_USER_CAP`, `STAKING_FULL`, `INSUFFICIENT_CT`, `ALLOWANCE_TOO_LOW`, `UNKNOWN_POSITION`, `POSITION_CLOSED`, `LOCK_NOT_ENDED`, `NOTHING_TO_CLAIM`, `BELOW_MIN_CLAIM`, `NOT_READY_TO_SETTLE`, `SIMULATION_FAILED` (`details.revert`); limits and broadcast `RATE_LIMITED_*`, `DAILY_BUDGET_EXHAUSTED`, `FEE_PAYER_BALANCE_LOW`, `RPC_UNAVAILABLE`, `BROADCAST_REJECTED` (`details.reason`), `BROADCAST_UNCERTAIN` (502, `details.txHash`: poll it before resending; resending the identical raw returns the same hash).

### GET /v1/tx/:hash

```json
{ "txHash": "0x8213…21db", "status": "mined", "action": "predict", "blockNumber": 234100120, "gasUsed": "65454",
  "result": { "marketId": 103919, "choice": 1, "answered": 5, "pointsCredited": 100, "welcomePoints": 100 } }
```

`status`: `pending`, `mined`, `reverted`, `unknown` (released before broadcast). `result` decodes `Predicted`, `PointsCredited`, `WelcomePaid`, `Converted`, `PlayKeySet`, `Staked`, `InterestClaimed`, `Withdrawn`. `TX_NOT_FOUND` (404) for an unknown hash.

---

## Dev only: POST /dev/rpc

Registered only with `DEV_CHAIN=stub` (refused in production). A JSON-RPC endpoint for the PWA's reads against the stub chain: `eth_chainId`, `eth_blockNumber`, `eth_gasPrice`, `eth_getBalance`, `eth_getTransactionCount` (the highest nonce the fee payer accepted from the sender, plus one), `eth_call` on CojamPredict (`dayOf`, `playKeyOf`, `playerOf`, `pendingHits`), `eth_estimateGas`, `kaia_getTransactionReceipt`. Sends are refused (`-32601`): transactions go through `POST /v1/tx/sponsor` as in production. `GET /v1/config` points `rpcUrl` here in that mode.

---

## Admin (`/admin/v1/*`)

Roles: `viewer` reads; `operator` performs writes the operator key carries out through the worker (and edits the email allow list); `owner` also builds owner transactions and manages the admin list. Owner transactions are only built unsigned (`unsignedTx`) for the master wallet to sign in the admin; the server never holds the owner key. Every write lands in `audit_log` with the actor. A write that needs the chain answers `{ "requestId": 41, "status": "queued" }` (an `operator_requests` row the worker runs).

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `GET /admin/v1/me` | viewer | `{ "privyUserId", "email", "role" }` |
| `GET /admin/v1/dashboard` | viewer | players, today's activity, completion rate, points issued and converted, reserves and runway, gas, invites, AI and job status, alerts |
| `GET /admin/v1/overview` | viewer | one compact call for "how is today going" (below) |
| `GET /admin/v1/params` | viewer | current and pending CojamPredict params, owner address |
| `POST /admin/v1/params` | owner | `{ "action": "propose", "params": {…} }`, `{ "action": "apply" }`, `{ "action": "cancel" }`: unsigned `proposeParams` / `applyParams` / `cancelParams` |
| `GET /admin/v1/questions?status=&from=&to=` | viewer | questions by day (default yesterday to 7 days ahead): three language texts with character counts, sources, rule, rationale, image state, picks, `editable` |
| `POST /admin/v1/questions/:id/cancel` | operator | `{ "reason" }`: before publish only; the worker refills the slot |
| `POST /admin/v1/questions/:id/replace` | operator | `{ "reason", "question"? }`: with `question` (category, `content` {en, ko, ja}, `resolvesAt` within 24 h of the day's end, `sources`, `criteria`) the text is replaced in place and the image regenerated; without it the worker picks a replacement |
| `POST /admin/v1/questions/:id/void` | operator | `{ "reason" }`: a live question, unresolved or inside its correction window (`voidMarket`: no hit points for anyone on it) |
| `POST /admin/v1/questions/:id/image` | operator | `{ "action": "regenerate" }`, `{ "action": "fallback" }`, `{ "action": "upload", "imageKey" }` |
| `GET /admin/v1/answers?status=due|window|final|all` | viewer | resolutions with every run, confidence, evidence, the correction window left, `late` |
| `POST /admin/v1/answers/:marketId/rerun` | operator | re-run the resolution |
| `POST /admin/v1/answers/:marketId/correct` | operator | `{ "outcome": 1|2|3, "reason" }`: inside the window `correctOutcome` (worker); after it an unsigned `setCorrectedOutcome` for the owner plus a queued `compensate` request (outcome 1 or 2 only) |
| `GET /admin/v1/ranking/:weekId` | viewer | full ranking (50), the airdrop rows, accounts on hold left out |
| `POST /admin/v1/ranking/:weekId/airdrop` | operator | trigger or retry the week's airdrop job |
| `GET /admin/v1/players?list=review|blocked|all&q=` | viewer | review list (open risk flags), blocked accounts with reason and last action, search by address or name |
| `GET /admin/v1/players/:wallet` | viewer | profile (no email hash), chain state, points by kind, freezes, risk flags, inviter, friends, code |
| `POST /admin/v1/players/:wallet/block` | operator | `{ "reason" }`: sponsorship stops at once, `setFrozen(true)` queued |
| `POST /admin/v1/players/:wallet/unblock` | operator | `{ "reason" }`: `setFrozen(false)` queued, 30 day clear mark |
| `POST /admin/v1/players/:wallet/clear` | operator | `{ "reason" }`: clear a review entry, 30 day mark |
| `GET /admin/v1/invites` | viewer | links per day, invited share of new players, invite and welcome points, top inviters, flagged clusters |
| `GET /admin/v1/email-domains` | viewer | the allow list with sign ups per domain in 7 days |
| `POST /admin/v1/email-domains` | operator | `{ "domain", "displayName", "rule": "gmail"|"plus"|"none" }` |
| `PATCH /admin/v1/email-domains/:domain` | operator | `{ "enabled"?, "rule"?, "displayName"? }` |
| `GET /admin/v1/system` | viewer | contracts, fee payer and owner, reserves, budgets, RPC, indexer, jobs, Claude usage, sponsorship statuses and errors in 24 h, registration queue, operator requests, recent audit |
| `GET /admin/v1/audit?before=&actor=&limit=` | viewer | audit log, newest first |
| `GET /admin/v1/operator-requests?status=` | viewer | the worker queue |
| `GET /admin/v1/admins` | viewer | admin allow list |
| `POST /admin/v1/admins` | owner | `{ "email", "role" }` add or change |
| `DELETE /admin/v1/admins/:email` | owner | remove (not yourself) |

Examples:

`POST /admin/v1/players/0x5823…e296/block` with `{ "reason": "device cluster" }`

```json
{ "wallet": "0x5823…e296", "frozen": true, "chain": "queued" }
```

`POST /admin/v1/answers/103913/correct` after the window with `{ "outcome": 2, "reason": "wrong source" }`

```json
{ "marketId": 103913, "path": "setCorrectedOutcome", "requestId": 52, "status": "queued",
  "unsignedTx": { "chainId": 1001, "from": "0x6fd4…f5b1", "to": "0xda6f…c40a", "data": "0x…", "value": "0", "description": "setCorrectedOutcome(103913, 2): then the worker runs compensate batches" } }
```

`POST /admin/v1/params` with `{ "action": "apply" }`

```json
{ "unsignedTx": { "chainId": 8217, "from": "0xd9da…ecab", "to": "0x…", "data": "0x…", "value": "0", "description": "applyParams" } }
```

Admin errors: `UNAUTHORIZED`, `FORBIDDEN` (not on the allow list), `ADMIN_FORBIDDEN` (role too low), `QUESTION_PUBLISHED`, `CORRECTION_WINDOW_OVER`, `CONFLICT`, `NOT_FOUND`.

---

## Operations agent

A separate Claude session the founder uses from a phone (brief: `docs/platform/OPS-AGENT.md`) calls the admin API with a service token.

* **Token.** `npx tsx scripts/make-service-token.ts` prints a new random token once (`cjops_…`) and its SHA-256. Put the hash in Render as `ADMIN_SERVICE_TOKEN_SHA256` on `cojam-app-api`; put the token in the agent's credential form (bearer for the API host). The token itself is never stored by us. Run the script again to rotate. With the variable unset the path is off.
* **Auth.** `Authorization: Bearer <token>` on `/admin/v1/*`. The hash is compared in constant time. The caller is the actor `ops-agent` with the role `operator`, never `owner`.
* **Limits and audit.** `ADMIN_SERVICE_PER_MINUTE` requests per minute (default 120, `RATE_LIMITED_USER` above it). Every write is in `audit_log` with actor `ops-agent`.
* **Allowed.** Every viewer endpoint, and the operator writes: question cancel, replace, void and image actions; answer rerun and correct (inside the window; after it the call only prepares the owner transaction, which the founder signs in the admin); airdrop trigger; player block, unblock and clear; email domain add and edit. **Not allowed** (owner only): `POST /admin/v1/params`, `POST` and `DELETE /admin/v1/admins`.

### GET /admin/v1/overview

```json
{
  "at": 1795715734, "network": "kairos", "dayId": 20783, "weekId": 2969,
  "alerts": [ { "level": "warning", "code": "DAY_INCOMPLETE", "message": "Day 20785 has 0 of 5 questions" } ],
  "today": [ { "marketId": 103915, "slot": 0, "category": "crypto", "title": "Will Bitcoin close above $100,000 today?", "left": "No", "right": "Yes",
               "status": "published", "outcome": null, "picks": { "left": 412, "right": 690, "total": 1102 }, "resolvesAt": 1795741200 } ],
  "players": { "total": 3120, "registered": 3044, "pending": 3, "refused": 73, "frozen": 12, "new_today": 41, "activeToday": 1180, "completedToday": 1012 },
  "points": { "issued_today": 141200, "issued_week": 498000, "converted_today": 12000, "converted_week": 61000, "referral_today": 9100 },
  "reserves": { "predictReserveWei": "250000000000000000000000", "predictRunwayDays": 410, "stakingAvailableRewardsWei": "480000000000000000000000",
                "stakingTotalPrincipalWei": "120000000000000000000000", "feePayerWei": "61000000000000000000", "feePayerRunwayDays": 33, "operatorWei": "18000000000000000000",
                "conversionsPerDayWei": "585000000000000000000", "snapshotAt": 1795715700 },
  "gas": { "todayWei": "1650000000000000000", "sponsoredToday": 5230, "perDay7Wei": "1800000000000000000" },
  "jobs": { "…": "worker summary" },
  "operatorRequests": { "queued": 1, "done": 14 },
  "answersNeedingAttention": [ { "marketId": 103912, "title": "Will it rain in Tokyo tomorrow?", "resolvesAt": 1795687200, "outcome": null, "lowestConfidence": 0.82 } ],
  "reviewListCount": 7
}
```

Alert codes: `FEE_PAYER_LOW`, `FEE_PAYER_RUNWAY`, `RESERVE_RUNWAY`, `DAY_INCOMPLETE` (today to 2 days ahead with fewer than 5 questions), `ANSWER_LATE` (6 h past `resolvesAt`), `REVIEW_LIST` (over 50), `REGISTRATION_FAILED`, `INDEXER_LAG`, plus the worker's own open alerts.
