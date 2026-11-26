# Cojam Daily Prediction: technical development plan

Status: draft 2, 2026-11-26. Folds in `docs/platform/REVIEW.md` (sections A and B) and every row of `docs/platform/DECISIONS.md`: Privy email login only, the play key, per market settle with a 48 hour resolution rule, the accepted review defaults, the master wallet as owner, Render and Cloudflare, and phases instead of dates. Scope is `docs/platform/PLAN-SOURCE.md` as amended by `docs/platform/DECISIONS.md`; where they differ, `DECISIONS.md` wins, and where this plan and either of them differ, they win. Screen ids, state names and copy match `docs/platform/SCREEN-SPEC.md`. Every number marked "estimate" must be replaced by a measurement on Kairos before mainnet.

Contents

1. Research findings and the recommended architecture
2. Architecture overview, repository layout, tech stack
3. Contract design
4. Background sending of one transaction per swipe (play key)
5. Anti abuse
6. Server and jobs
7. Data model
8. Security, self audit, tests
9. Environments and deploy
10. Phases and acceptance criteria
11. Open questions for the founder
12. Sources

---

## 1. Research findings and the recommended architecture

### 1.1 A. Can a Privy embedded wallet sign a Kaia fee delegated transaction (type 0x31)?

What a 0x31 sender signature is. Kaia defines the sender hash as `SigHash = keccak256(SigRLP)` with `SigRLP = encode([encode([type, nonce, gasPrice, gas, to, value, from, input]), chainid, 0, 0])`, and the sender signed form as `SenderTxHashRLP = type + encode([nonce, gasPrice, gas, to, value, from, input, txSignatures])` with `txSignatures = [[v, r, s]]` [11]. In Kaia's example the sender `v` is `chainId x 2 + 35 + yParity` (0x25 for chain id 1) [11], which is also how `server/src/policy.js` reads it. So a sender signature is a plain secp256k1 signature over a 32 byte hash. No wallet specific transaction support is needed, only a "sign this hash" primitive.

What the Kaia SDK already gives us. `@kaiachain/js-ext-core` (already a dependency of `server/`) exposes on every Kaia transaction object `sigRLP()`, `addSenderSig(sig)` and `senderTxHashRLP()` (`server/node_modules/@kaiachain/js-ext-core/dist/esm/tx/abstract.d.ts`). The PWA can build the 0x31 object, hash `sigRLP()`, get a signature from anywhere, attach it and post the result to a fee payer endpoint exactly like the swap site does today.

What Privy documents.

| Question | Finding | Status |
| --- | --- | --- |
| Raw hash signing from the browser | `secp256k1_sign` through the embedded wallet's EIP-1193 provider (`wallet.getEthereumProvider()` then `provider.request({ method: 'secp256k1_sign', params: [hash] })`) is documented for React and other client SDKs; also as REST and Node `secp256k1Sign` [1][2] | Confirmed by docs |
| Privy's own warning | The page says the method mainly serves smart wallet integrations and EIP-7702 authorizations, and recommends message signing for ordinary use [1] | Supported, not the main path: test well |
| Is Kaia a supported chain | Privy's chain page puts Ethereum "including EVM-compatible networks" at Tier 3 (send transactions) and says Tier 1 raw signing works on "any chain on a supported curve" [3]. Kaia is not named. Custom EVM chains are added with viem `defineChain` in `supportedChains` [4] (viem ships `kaia` 8217 and `kairos` 1001) | Confirmed as a custom EVM chain; Kaia not named |
| Signing without a prompt | Confirmation modals can be turned off in the Dashboard or with `showWalletUIs: false`, globally or per call; Privy warns this changes the trust relationship [7] | Confirmed for the standard sign methods; not stated for `secp256k1_sign` |
| Server side signing (session signers) | Apps can add "signers" to user wallets and sign from the server through Privy's enclave, scoped by policies [5][18] | Confirmed |
| Can policies restrict raw signing | The policy method list covers `eth_sendTransaction`, `eth_signTransaction`, `eth_signTypedData_v4`, `personal_sign`, `eth_sign7702Authorization` and others; `secp256k1_sign` is not in it, and unnamed methods default to deny [6] | A server signer cannot be limited to our contracts when it signs raw hashes |
| Signature format returned | Not documented (65 bytes expected; `v` may be 27/28 or 0/1) | Spike |

Conclusion for A. Documentation supports the path "PWA computes the Kaia SigHash, the Privy embedded wallet signs it with `secp256k1_sign`, the PWA attaches the signature and posts the 0x31 transaction to our fee payer". Nothing in Privy's or Kaia's docs rules it out. With the play key (section 4) the Privy wallet signs only the play key authorisation and value actions (convert, approve, stake, claim, withdraw principal), not swipes, so this path no longer sits inside every swipe. Five things are not documented and must be proven by the spike (section 10, phase 0): that `secp256k1_sign` runs with no modal inside an installed PWA on iOS and Android; the returned signature format and the `v` conversion; that a Kaia node accepts the result; the latency per signature; and whether Privy bills each raw signature against the "signatures" allowance (section 1.3).

Session signers are not recommended for this. They would let our server sign for users with no client involved, but because raw hash signing is outside Privy's policy methods [6], a server signer able to sign Kaia hashes could sign any transaction for every user wallet. A leak of our authorization key would then reach every user's CT. Client side signing keeps that power in each user's own session.

### 1.2 B. The fallback: signed intents and a Cojam relayer

If the spike fails, users sign an EIP-712 message with `signTypedData` (a standard Privy method, modal can be off, and it is covered by the policy engine [6][7]) and a Cojam relayer sends the transaction from its own KAIA funded key.

| Option | How it works | Fit |
| --- | --- | --- |
| ERC-2771 trusted forwarder | A forwarder contract verifies a generic signed request and calls the target, which reads the real sender from the end of the calldata (`_msgSender()`) | Rejected: every function of every contract trusts the forwarder, so a forwarder bug or a signed request of the wrong shape reaches everything, including staking principal. More audit surface than we need |
| Function specific signed intents | Each sponsored function gets a `...BySig` twin that verifies an EIP-712 struct for exactly that action (`Predict(user, marketId, choice, deadline)`, `Convert(user, points, nonce, deadline)`, `Stake(user, amount, lockIndex, nonce, deadline)`, ...) and then runs the same internal function | Recommended fallback: narrow, each struct names the action, `deadline` bounds replay, OpenZeppelin `EIP712` and `Nonces` cover the mechanics |

Swipes are not affected by the fallback: the play key is a local key, not a Privy wallet, so it sends its own 0x31 `predict` transactions through the fee payer in both paths (section 4). In path B only the play key authorisation (`setPlayKeyBySig(player, key, expiresAt, nonce, deadline, sig)`) and the value actions go through the relayer.

Idempotency in the intent path. `Predict` needs no nonce: the contract accepts one prediction per user per market, so a replayed signature is a no op that reverts in simulation and is never broadcast. Conversion, stake, claim and principal withdrawal take a per user nonce (`Nonces`) plus a deadline.

The staking deposit problem. CT has no `permit`, so the staking contract can only pull CT that the user's own wallet approved by a transaction the wallet itself sends. A relayer cannot send an approve for someone else. The candidates:

| Way to get the allowance | Gas paid by | Verdict |
| --- | --- | --- |
| One fee delegated 0x31 `approve` | Cojam (fee payer) | Needs path A to work, so if A works we use A for everything |
| KAIA drip: the relayer sends about 0.005 KAIA once to a registered wallet that holds at least the minimum stake, then the PWA sends a normal `approve(staking, max)` through Privy's `eth_sendTransaction` (Privy sends on EVM chains [3]) | Cojam, indirectly | Recommended in path B. Bounded abuse: one drip per registered player, only with 100 CT or more in the wallet, and the KAIA can only pay gas |
| EIP-7702 delegation | Cojam (relayer) | Kaia activated Prague with EIP-7702 / KIP-228 SetCode on mainnet at block 190,670,000 on 2025-07-17 [13][14] and Privy signs `eth_sign7702Authorization` [6]. Strong but new on Kaia, with Kaia specific differences in KIP-228; not for launch |
| Kaia gas abstraction (pay gas by swapping a token) | User, in tokens | Only whitelisted tokens managed by the Kaia Foundation [12]; CT is not whitelisted |
| "Convert and stake" (points convert straight into a position) | Cojam | Covers converted CT only, not deposits from outside |
| Credit CT sent to the staking contract without approve | | Rejected: an unlabelled transfer cannot be attributed safely |

### 1.3 C. Privy pricing, email login, PWA behaviour

Pricing (privy.io/pricing, read 2026-11-26) [8]:

| Plan | Price | MAU | Signatures included |
| --- | --- | --- | --- |
| Developer Free | 0 | 0 to 499 | 50,000 a month |
| Developer Core | $299 a month | 500 to 2,499 | 50,000 a month |
| Developer Scale | $499 a month | 2,500 to 9,999 | 50,000 a month |
| Above 10,000 MAU or 50,000 signatures | $2,000 base plus $0.05 per MAU above 10,000 and $0.01 per signature above 50,000 | | |
| Enterprise | custom, "from $0.001 per signature" | | |

An MAU is an authenticated user with a session in the last 30 days [8]. Without a play key, one transaction per swipe would mean at least 5 Privy signatures per player per day: about 477,000 a month at 3,000 daily players, about $4,270 a month in overage on the Developer plans (REVIEW A1). With the play key (section 4) Privy signs only the play key authorisation (about once per device per 30 days) and value actions, about 36,000 signatures a month at 3,000 daily players, inside the 50,000 included (section 4.9). Whether a client side `secp256k1_sign` counts as a billed "signature" is still asked of Privy in writing (spike item 6), but it no longer decides the budget.

Login: **Privy email login only, with a one time code** (DECISIONS, 2026-11-26). No social providers, no external wallet connect [9]. The user enters an email address, Privy sends a 6 digit code, the user types it in the app, and Privy creates the Kaia embedded wallet on the first login. Code length, code lifetime and Privy's send and attempt limits are recorded by the spike (item 5) and copied into the A1 copy; the PWA adds its own 60 second resend timer. Email login has no OAuth redirect, so the iOS standalone redirect risk of social login is gone.

PWA behaviour.

* Install: Android Chrome fires `beforeinstallprompt`; iOS Safari has no install API, so the Gate shows "Share, then Add to Home Screen" steps. Standalone detection: `matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`.
* iOS storage: a home screen web app has its own storage, separate from Safari, so a user logs in again inside the installed app; WebKit counts days of use separately for home screen apps, so the 7 day script storage cap does not wipe an app that is used [17]. The play key lives in this storage (IndexedDB), so an eviction costs one new login and one "Setting up your game" step, nothing else.
* Email code inside an iOS standalone app: the user leaves the app to read the code in Mail and comes back. iOS may reload a backgrounded standalone app, so the PWA keeps the pending email and the "code sent" time in `[local]` and returns to the code step on reload; whether Privy's pending code survives a reload is a spike item. The code field uses `autocomplete="one-time-code"` so iOS and Android can offer the code from Mail or Messages. A published Next.js PWA template uses Privy embedded wallets with a service worker and an install prompt [15].

### 1.4 Recommended architecture (decision for phase 0)

**Path A, Kaia native fee delegation, with two signers.**

* **The play key signs swipes.** On the first login on a device the PWA creates a local key, and the Privy wallet authorises it once on chain with `setPlayKey(address key, uint64 expiresAt)` (REVIEW A1, adopted in DECISIONS). From then on every swipe is a 0x31 `predict` whose sender is the play key itself, signed on the device in a few milliseconds: no Privy signature, no prompt, no network round trip to sign. The contract resolves the player from the key. The play key can only predict and revoke itself; it holds no funds and cannot convert, stake, claim or withdraw.
* **The Privy wallet signs value actions.** The play key authorisation, convert, approve for staking, stake, claim interest and withdraw principal are 0x31 transactions whose sender is the user's Privy wallet. The PWA computes the SigHash with `@kaiachain/js-ext-core`, signs it with `secp256k1_sign` with no modal, and posts it to the fee payer.

Both kinds go to one fee payer endpoint that reuses the decoding, policy and co-signing code of `server/`. Contracts read `msg.sender` only, plus the play key lookup in `predict`.

Why the play key account sends its own 0x31 transactions rather than signing EIP-712 messages for a relayer (the alternative considered): the fee payer stays the only server signer and has no nonce of its own in 0x31, so it scales horizontally and never serialises users; each play key has its own nonce sequence on its own device, so the outbox keeps the simple nonce rules of section 4.4; a 0x31 sender needs no KAIA, so the key never holds funds; and no relayer pool, nonce queue or `predictBySig` function is needed.

Reasons for path A overall: one code path for every action including the approve that staking needs; `msg.sender` is the user (or the user's key), so contracts stay small and close to the house style of `CojamMigration.sol`; the fee payer code is already built, unit tested and format checked against mainnet (`docs/FEE-DELEGATION.md` section 1); and server compromise cannot move user funds, because the server only co-signs what users or their keys signed.

**Fallback, path B, chosen only if the spike shows that `secp256k1_sign` cannot be used:** the play key path stays as it is (it does not depend on Privy's raw signing). The play key authorisation and the value actions become function specific EIP-712 intents (`setPlayKeyBySig`, `convertBySig`, `stakeBySig`, ...) sent by a relayer pool, plus a one time KAIA drip for the staking approve (section 1.2). Contracts are written with every user action as an internal function `_convert(user, ...)` behind a thin wrapper, so the `...BySig` wrappers can be added in a day; they are not shipped if path A passes, to keep the audit surface small.

The direct path (a `predict` signed by the Privy wallet itself) stays valid in the contract and in the fee payer policy, so play continues if a device cannot keep a play key; it is not the normal path.

What the first spike must prove (phase 0 gate, all on Kairos 1001):

1. `secp256k1_sign` over a Kaia SigHash returns a signature with no modal, in an installed PWA on iOS 17+ Safari and Android Chrome, right after login and after a cold restart a day later.
2. `v` conversion (27/28 or 0/1 to `chainId x 2 + 35 + yParity`) and that `server/src/policy.js` decoding recovers the Privy wallet address.
3. A 0x31 `setPlayKey` signed by the Privy wallet is co-signed and mined; then the new play key (an account that never held KAIA) sends 5 `predict` transactions signed back to back with nonces 0 to 4 without waiting for receipts, all co-signed and mined in order, and the contract credits the Privy wallet, not the key.
4. Latency: local play key signing (target under 50 ms p95) and one `secp256k1_sign` call (target under 1.5 s p95; it runs only at setup and for value actions).
5. Email login from the installed PWA on a real iPhone and an Android phone: code delivered, `one-time-code` autofill, leaving for Mail and coming back (including an app reload) still reaches a logged in session; record the code length, code lifetime and Privy's resend and attempt limits.
6. Privy's answer in writing: is a raw signature from the user's client billed as a "signature", and does an email login count as one?
7. A normal user paid transfer through Privy `eth_sendTransaction` on Kaia (for W4).
8. Kaiascan shows the point balance of the soulbound ledger (section 3.2) as a token holding.
9. The play key survives in IndexedDB across a cold restart and 7 days without use on iOS and Android; record the result of `navigator.storage.persist()`.
10. The direct path: a `predict` signed by the Privy wallet is co-signed and mined (fallback when a device cannot keep a play key).

---

## 2. Architecture overview, repository layout, tech stack

### 2.1 Diagram

```
                     Installed PWA  app.cojam.app  (browser tab: G1 Gate only)
   +----------------------------------------------------------------------------------+
   | React UI (H1..P1)  |  Outbox (IndexedDB, one sender loop)  |  Privy SDK           |
   |  optimistic state  |  play key signs 0x31 predict -> POST  |  email code login,   |
   |                    |  play key in IndexedDB                |  embedded wallet     |
   +---------+-------------------------+---------------------------+  (TEE)            |
             | reads (REST)            | POST /v1/tx/sponsor       |  secp256k1_sign:  |
             v                         v                           |  setPlayKey and   |
   +------------------------------------------------------------+  |  value actions    |
   | cojam-app-api  (Fastify, app-api.cojam.app)                |  +-------------------+
   |  Privy JWT auth | read API | fee payer (co-sign 0x31)      |       Admin  admin.cojam.app
   |  policy + limits + simulate | admin API | audit log        |<----- (Privy email login, allow list,
   |                                                            |        owner txs signed by the master wallet)
   +-------------+-----------------------------+----------------+
                 | Postgres (Render)           | kaia_sendRawTransaction
   +-------------v-----------------+           v
   | cojam-app-worker              |    +--------------------------------------------+
   |  indexer (logs -> DB)         |    | Kaia mainnet 8217                          |
   |  operator jobs: register,     |--->|  CojamPredict  (points ledger, markets,    |
   |   createDay, setOutcome,      |    |                 predictions, conversion,   |
   |   settleMany, airdrop         |    |                 weekly airdrop)            |
   |  AI pipeline (Claude API):    |    |  CojamStaking  (positions, interest)       |
   |   draft, validate, translate, |    |  CT 0x91cb3B346C80ff965a9667ba6228834dbedD71a2
   |   resolve with evidence       |    +--------------------------------------------+
   |  monitors and alerts          |           ^ plain CT transfers (reserves)
   +-------------------------------+     Master wallet (owner and treasury) funds both contracts
```

Keys: the user's wallet key lives in Privy; the play key lives on the user's device (IndexedDB) and can only predict; the app fee payer key lives in `cojam-app-api`; the operator key lives in `cojam-app-worker`; the owner key is the master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, an EOA in the founder's wallet apps only (never on a server).

### 2.2 Repository layout

```
contracts/                         existing Hardhat 2 project, shared toolchain (solc 0.8.28, OZ 5.4.0, evm paris)
  contracts/platform/
    CojamPredict.sol               points ledger, markets, predictions, conversion, airdrop
    CojamStaking.sol               staking
    interfaces/ICojamPredict.sol, ICojamStaking.sol
  test/platform/                   unit, fuzz (invariants), fork tests against mainnet CT
  scripts/platform/                deploy-kairos.js, deploy-mainnet.js, fund.js, params.js
  deployments/platform.kairos.json, platform.kaia.json
platform/                          new, npm workspaces
  shared/                          TypeScript: ABIs (generated from contracts/artifacts), addresses per network,
                                   time rules (dayId, weekId), error codes, i18n keys for codes
  app/                             PWA (Vite + React + TS), served on app.cojam.app
  admin/                           Admin SPA (Vite + React + TS), served on admin.cojam.app
  api/                             Fastify API + worker entry (same package, two start commands)
    src/feeDelegation/             ported from server/src/policy.js and feePayer.js (decode, recover, co-sign)
    src/indexer/  src/jobs/  src/ai/  src/admin/  src/db/ (migrations)
server/                            unchanged (swap gas API and keeper)
site/                              unchanged (cojam.app swap site)
docs/platform/                     PLAN-SOURCE, DECISIONS, DEV-PLAN (this file), screen spec
```

Sharing: `contracts/` keeps one compiler setup, `verify-sourcify.js` and the `ops.js` pattern (a manual Render cron job for mainnet deploys). The fee delegation code is copied into `platform/api` rather than imported from `server/`, so the live swap service is never redeployed by platform work; once both are stable, extract it into one workspace package used by both (a later, separate change).

### 2.3 Tech stack

| Layer | Choice | One line reason |
| --- | --- | --- |
| PWA framework | Vite + React 18 + TypeScript | Privy's web SDK is React first (`@privy-io/react-auth`); Vite builds a static bundle Render serves for free |
| Routing | React Router (hash free, `history`) | Few screens, deep links for `?lang=` and results |
| Server and chain state | TanStack Query | Caching, retries and background refetch of reads; optimistic updates for swipes |
| Local state and outbox | Zustand + Dexie (IndexedDB) | Small store; the outbox must survive an app kill |
| Chain code in the browser | viem (reads, ABI encoding, play key generation and local secp256k1 signing) + `@kaiachain/js-ext-core` (0x31 build, SigRLP, sender RLP) | viem is what Privy uses; js-ext-core is Kaia's own encoder, already proven in `server/` |
| Login | Privy email login with a one time code (`@privy-io/react-auth`, headless email flow so A1 uses our own screens) | DECISIONS: email only; our own screens keep the copy and the three languages under our control |
| Gestures and motion | `@use-gesture/react` + Motion (Framer Motion) | Swipe with velocity thresholds and spring return; respects reduced motion |
| i18n | i18next + react-i18next, ICU plural format, JSON per locale (en source, ko, ja) | Mature, lazy loading per locale, matches the site's EN / KO / JA toggle |
| Fonts | Pretendard Variable (en, ko), Pretendard JP Variable (`:lang(ja)`), tabular numerals | Brand table in `CLAUDE.md` |
| Service worker | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'` | Precache the shell, never cache API or chain responses, user accepted updates |
| Admin | Vite + React + TS, TanStack Table, same i18n keys (English only UI is fine) | Same toolchain as the PWA, desktop only |
| API | Node 20 + Fastify + TypeScript + zod | Schema validated routes, fast, small; the existing server is plain Node so the team already runs Node on Render |
| Database | Render Postgres 16 + Kysely (typed SQL) + plain SQL migrations | Relational data (markets, predictions, weeks); Kysely keeps queries explicit |
| Job runner | pg-boss (Postgres backed queue and cron) inside the worker | No extra Redis; jobs are durable, retried and visible in SQL |
| Rate limits and idempotency | Postgres rows with unique keys (and an in memory cache) | One store, survives deploys, works with several API instances |
| Privy server | `@privy-io/node` (JWT verification, user lookup) | Verifies access tokens and maps user to embedded wallet |
| AI provider | Claude API, `claude-opus-5-5` with adaptive thinking, `web_search_20260209` and `web_fetch_20260209`, structured outputs, server side `fallbacks: "default"` | Latest Claude model; built in search and fetch with domain allow lists; schema checked JSON output |
| Monitoring | Sentry (PWA, admin, API, worker) + Render health checks + an external uptime monitor on `/v1/health?strict=1` | Error traces with release tags; alerts by email and Telegram |

---

## 3. Contract design

Both contracts follow `CojamMigration.sol` house style: NatSpec on every item, custom errors, `SafeERC20`, `ReentrancyGuard`, measured balance changes on pulls, no upgrade proxy, Sourcify verified.

### 3.1 Time rules (shared by contracts, server and PWA)

* `dayId = block.timestamp / 1 days` (UTC days). Day `d` opens at `d x 86400` = 00:00 UTC = **09:00 KST / JST**, and lasts 24 hours. This is "a new set every 24 hours" with one global boundary for Korea and Japan (decided, REVIEW B3).
* `weekId = (dayId + 3) / 7`: weeks run Monday 00:00 UTC to the next Monday 00:00 UTC (Monday 09:00 KST). 1970-01-01 was a Thursday, so `+3` aligns Mondays.
* A day's 5 markets accept predictions from the day's open until each market's own `closesAt`, never later than the day's end. A market not answered by then is gone and cannot be caught up later; the countdown on H3 counts to the next day's open.
* **48 hour rule.** Every market of a day is resolved (answer set or voided) within 48 hours of the day's end (REVIEW A2). The contract enforces it: `createDay` requires `resolvesAt <= dayEnd + 24 h`, `setOutcome` is refused after `dayEnd + RESOLVE_DEADLINE` (48 h, a constant), and after that anyone may call `voidExpired(marketId)`. So every hit point of day `d` is final by `dayEnd + 48 h + settleDelay` at the latest.

### 3.2 Points model: decision

**Recommended: the point ledger lives inside `CojamPredict` and is ERC-20 shaped but soulbound.** It exposes `name()` "Cojam Points", `symbol()` "CJP", `decimals()` 0, `totalSupply()`, `balanceOf()`, and emits `Transfer(address(0), user, amount)` on every credit and `Transfer(user, address(0), amount)` on every conversion. `transfer`, `transferFrom` and `approve` exist only to revert with `PointsNonTransferable()`, and `allowance` returns 0.

| | Soulbound ERC-20 shape (recommended) | Internal ledger only |
| --- | --- | --- |
| Explorer | Kaiascan can list holders and balances, users can verify their points | Only events in the contract's log tab |
| Wallets | May show "CJP" as a token; it cannot be sent, so no market forms | Nothing shown |
| Risk | Someone may think CJP is tradable: the name, the explorer note and the reverting transfer make it clear | None |
| Cost | About 1,500 gas per credit for the extra event | Lowest |

Same contract rather than a separate token contract: the ledger and the rules that change it stay in one place, so "balances change only through platform contracts" (DECISIONS) is enforced by code layout, not by roles. Spike item 8 checks that Kaiascan detects it.

### 3.3 How a set of 5 and a prediction are represented

* `marketId = dayId x 5 + slot`, `slot` 0 to 4. Ids are predictable, so the PWA and the server need no lookup.
* One `Market` struct per id (two storage slots). Question text, choice labels and translations are off chain; the contract stores `contentHash = keccak256(canonical JSON of the English question, choices, close and resolve times, sources)` for audit.
* One `UserDay` struct per user per day, packed in one storage slot: how many of the 5 are answered, the 5 choices in 2 bits each (0 none, 1 choice A, 2 choice B), the completed flag, a 5 bit mask of the slots already settled (per market settle, REVIEW A2) and the hit count.
* Each swipe is one transaction (`predict(marketId, choice)`), as the founder decided, sent by the device's play key on behalf of its player; section 4 covers the play key, background sending, nonces and retries.

### 3.4 `CojamPredict`

Storage:

```solidity
IERC20 public immutable CT;                       // 0x91cb3B346C80ff965a9667ba6228834dbedD71a2 on mainnet

struct Market {                                   // slot 1
    uint64 closesAt;                              // predictions accepted while block.timestamp < closesAt
    uint64 resolvesAt;                            // outcome may be set from this time
    uint64 resolvedAt;                            // when the outcome was first set (0 = not yet)
    uint8  outcome;                               // 0 none, 1 choice A, 2 choice B, 3 void
    uint8  correctedOutcome;                      // set only after the settle window (compensation path), else 0
    bytes32 contentHash;                          // slot 2
}
struct UserDay {                                  // one slot
    uint8  answered;                              // 0..5
    uint16 choices;                               // 2 bits per slot
    bool   completed;                             // completion points credited
    uint8  settledMask;                           // bit i set: slot i settled (hit credited or not)
    uint8  hits;
}
struct Player { bool registered; bool frozen; uint64 registeredAt; }
struct PlayKey { address key; uint64 expiresAt; }  // one slot; key 0 = none

mapping(uint256 marketId => Market) public markets;
mapping(address user => mapping(uint32 dayId => UserDay)) public userDays;
mapping(address user => Player) public players;
mapping(address player => PlayKey) public playKeyOf;               // one active key per player
mapping(address key => address player) public playerOfKey;         // a key serves one player only
uint64 public constant MAX_PLAY_KEY_TTL = 90 days;
uint64 public constant RESOLVE_DEADLINE = 48 hours;                // after the day's end (3.1)
mapping(address user => uint256) public balanceOf;                 // points
uint256 public totalSupply;                                        // points
struct WeekScore { uint192 points; uint64 lastCreditAt; }           // one slot; lastCreditAt breaks ties
mapping(uint32 weekId => mapping(address user => WeekScore)) public weekPoints;
mapping(uint32 weekId => bool) public airdropDone;
mapping(uint256 marketId => mapping(address user => bool)) public compensated;
mapping(address user => mapping(uint32 dayId => uint256)) public convertedCtOnDay;
mapping(uint32 dayId => uint256) public convertedCtTotalOnDay;
Params public params;  PendingParams public pending;               // see 3.6
```

Functions and access control:

| Function | Caller | Rules | Effect |
| --- | --- | --- | --- |
| `registerPlayer(address wallet)`, `registerPlayers(address[] wallets)` | OPERATOR | not zero, not registered, not bound as anyone's play key | Marks a Privy wallet as a player (the anti abuse gate, section 5) |
| `setFrozen(address wallet, bool frozen, bytes32 reason)` | OPERATOR (freeze), OWNER (unfreeze) | registered | A frozen player cannot predict (directly or through a play key), convert, set a play key, or receive an airdrop; balances are never reduced |
| `setPlayKey(address key, uint64 expiresAt)` | the player's own wallet (`msg.sender` is the player; sponsored) | registered, not frozen, `key != 0`, `key != msg.sender`, key is not a registered player, `playerOfKey[key]` is 0 or the caller, `now < expiresAt <= now + MAX_PLAY_KEY_TTL` | Unbinds the player's previous key (one active key per player), binds the new one, emits `PlayKeySet` |
| `revokePlayKey()` | the player, or the player's current play key | a key is set | Unbinds it, emits `PlayKeyRevoked`. Lets logout revoke without a Privy signature |
| `createDay(uint32 dayId, MarketInput[5] calldata m)` | OPERATOR | `block.timestamp < dayId x 1 days` (before the open), day not created, each `closesAt` in `(open, open + 1 days]`, `resolvesAt >= closesAt + minResolveGap`, `resolvesAt <= open + 1 days + 24 hours` (48 hour rule, 3.1), `contentHash != 0` | Writes 5 markets, emits `DayCreated` |
| `voidMarket(uint256 marketId, bytes32 reason)` | OPERATOR | not settled for anyone yet (before `resolvedAt + settleDelay`, or not resolved) | `outcome = 3` |
| `voidExpired(uint256 marketId)` | anyone | no outcome set and `now >= dayEnd + RESOLVE_DEADLINE` | `outcome = 3`; guarantees the 48 hour rule even if the operator is down |
| `predict(uint256 marketId, uint8 choice)` | the player's wallet, or the player's play key while `now < expiresAt` (the contract resolves the player: `player = playerOfKey[msg.sender]` when that binding is current, else `msg.sender`); player registered, not frozen, not paused | day created, `now >= open`, `now < closesAt`, `choice` 1 or 2, slot not answered | Stores the choice for the player; on the fifth answer credits `completionPoints` to the player (section 4.6) |
| `setOutcome(uint256 marketId, uint8 outcome)` | OPERATOR (AI keeper) | `now >= resolvesAt`, `now < dayEnd + RESOLVE_DEADLINE`, outcome 1, 2 or 3, not set | Stores outcome and `resolvedAt`, O(1) |
| `correctOutcome(uint256 marketId, uint8 outcome)` | OPERATOR | set, `now < resolvedAt + settleDelay` | Replaces the outcome inside the window; no one has been credited yet |
| `settle(address user, uint32 dayId)` | anyone | at least one answered or voided slot of the day whose market has `now >= resolvedAt + settleDelay` and is not yet in `settledMask` (per market settle, REVIEW A2) | For each such slot: adds it to `settledMask`, counts a hit if the user's choice equals the outcome, credits `hitPoints` per hit to balance and to `weekPoints[weekOf(dayId)]`. May run several times for one day as markets resolve at different times |
| `settleMany(address[] users, uint32 dayId)` | anyone (keeper) | at most 200 users; users with nothing ready are skipped | Batch of `settle` |
| `setCorrectedOutcome(uint256 marketId, uint8 outcome)` | OWNER | after the window, outcome differs from the stored one | Records the true answer for compensation; does not change past credits |
| `compensate(uint256 marketId, address[] users)` | OPERATOR | `correctedOutcome != 0`; for each user: that market's slot is in `settledMask`, user's choice equals `correctedOutcome`, not yet compensated; at most 500 users | Credits `hitPoints` per user (verifiable on chain: no free minting) |
| `convert(uint256 points)` | registered, not frozen, not paused | `points >= minConvertPoints`, `points % pointsPerCT == 0`, account older than `minAccountAge`, per user and global daily CT caps, reserve holds the CT | Burns points, sends `points x 1e18 / pointsPerCT` CT to the caller |
| `airdrop(uint32 weekId, address[] winners, uint256 pool)` | OPERATOR | week ended `airdropDelay` ago, not done, `winners.length <= 10`, distinct, registered, not frozen, strictly ordered by `weekPoints` points (higher first), then by `lastCreditAt` (earlier first), then by address (lower first), `pool <= maxWeeklyPool`, reserve holds `pool` | Pays `pool x splitBps[i] / 10000` to each winner, marks done |
| `proposeParams(Params)`, `applyParams()`, `cancelParams()` | OWNER | bounds (3.6); apply after `PARAM_DELAY` (48 h) | Economic changes are announced on chain 48 h ahead |
| `pause()` / `unpause()` | PAUSER / OWNER | | Pauses `predict` and `convert` only; settle, compensate, views keep working |
| `withdrawReserve(uint256 amount, address to)` | OWNER | `to == params.treasury` | Takes unused CT back |
| `transfer`, `transferFrom`, `approve` | anyone | always revert `PointsNonTransferable()` | |

A play key is never a registered player, so every function other than `predict` and `revokePlayKey` treats it as an unknown address: `convert`, `setPlayKey` and the staking functions revert for it. That is what limits a play key to predicting.

Views: `name`, `symbol`, `decimals`, `allowance` (0), `dayOf(address, uint32) -> (answered, choices[5], completed, settledMask, hits)`, `pendingHits(address, uint32) -> (points, landsAt)`, `playerOf(address key) -> (player, expiresAt, valid)`, `previewConvert(points)`, `reserve()`, `currentDay()`, `weekOf(dayId)`.

Events:

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);          // point mint and burn only
event PlayerRegistered(address indexed wallet);
event PlayerFrozen(address indexed wallet, bool frozen, bytes32 reason);
event PlayKeySet(address indexed player, address indexed key, uint64 expiresAt);
event PlayKeyRevoked(address indexed player, address indexed key);
event DayCreated(uint32 indexed dayId, bytes32[5] contentHashes);
event Predicted(address indexed user, uint256 indexed marketId, uint32 indexed dayId, uint8 choice, uint8 answered); // user is the player, never the key
event PointsCredited(address indexed user, uint32 indexed weekId, uint32 dayId, uint8 kind, uint256 amount); // 1 completion, 2 hits, 3 compensation
event OutcomeSet(uint256 indexed marketId, uint8 outcome, bool correction);
event MarketVoided(uint256 indexed marketId, bytes32 reason);                  // reason "expired" for voidExpired
event Settled(address indexed user, uint32 indexed dayId, uint8 slotsMask, uint8 hits, uint256 points);
event CorrectedOutcomeSet(uint256 indexed marketId, uint8 outcome);
event Compensated(uint256 indexed marketId, address indexed user, uint256 points);
event Converted(address indexed user, uint256 points, uint256 ctAmount);
event AirdropPaid(uint32 indexed weekId, uint8 rank, address indexed user, uint256 amount);
event ParamsProposed(Params p, uint64 applyAfter);  event ParamsApplied(Params p);
event ReserveWithdrawn(address indexed to, uint256 amount);
```

Errors: `NotRegistered`, `Frozen`, `DayNotOpen`, `MarketClosed`, `AlreadyPredicted(uint256 marketId)`, `BadChoice`, `DayExists`, `BadTimes`, `NotResolvable`, `AlreadyResolved`, `CorrectionWindowOver`, `NotReadyToSettle`, `AlreadySettled`, `NothingToCompensate`, `BelowMinimum`, `NotMultipleOfRate`, `AccountTooNew`, `DailyCapReached(uint256 left)`, `InsufficientReserve(uint256 available, uint256 needed)`, `WeekNotOver`, `AirdropDone`, `BadWinners`, `PoolTooLarge`, `ParamOutOfBounds(uint8 which)`, `TooEarly`, `PointsNonTransferable`, `ZeroAddress`, `BatchTooLarge`, `BadPlayKey`, `PlayKeyTaken`, `BadExpiry`, `NoPlayKey`, `ResolveDeadlinePassed`, `NotExpired`.

Invariants (each one a fuzz invariant in `test/platform/`):

1. `totalSupply == sum(balanceOf)`.
2. Points are created only by `predict` (completion), `settle` (hits) and `compensate`; destroyed only by `convert`. No function moves points between addresses.
3. A user has at most one choice per market, and only while `open <= now < closesAt`.
4. Each `(user, dayId)` receives completion points at most once; each `(user, marketId)` is settled at most once (its bit in `settledMask`) and compensated at most once, and only if the user's choice equals `correctedOutcome`.
5. An outcome is never set before `resolvesAt` nor after `dayEnd + RESOLVE_DEADLINE`; once `resolvedAt + settleDelay` has passed it never changes.
6. CT out (conversions, airdrops, owner withdrawals) never exceeds CT in; `convert` and `airdrop` revert rather than overdraw.
7. One airdrop per week, its total at most `maxWeeklyPool`.
8. `setOutcome`, `correctOutcome`, `voidMarket`, `voidExpired`, `setPlayKey` are O(1); `settleMany`, `compensate`, `registerPlayers` are bounded by their batch caps.
9. A player has at most one bound play key and a key serves at most one player; a play key's call only ever changes its own player's choices; no play key call moves points or CT.

Completion and hit crediting, and why this shape. The completion reward is pushed by the fifth `predict` (the user pays nothing, it is one extra storage write). Hit points are **not** pushed by the answer transaction: `setOutcome` is O(1) whatever the number of players. Hits are computed lazily **per market** by `settle`, which anyone may call; our keeper calls `settleMany` for every player of a market once that market's settle delay has passed, so one slow question no longer holds back the hit points of the other four (REVIEW A2). The settle delay (default 6 hours, REVIEW B4) is the correction window: the second AI pass (section 6.4) can fix a wrong outcome before a single point is credited, and the hit shows as pending with the time it lands until then. After the window, a wrong answer is handled by `setCorrectedOutcome` plus `compensate`, which only pays users whose on chain choice matches the corrected outcome. Points credited on the wrong answer are never taken back (REVIEW B5).

Conversion source. `CojamPredict` holds its own CT reserve, funded by plain transfers from the master wallet (the same funding model as the swap). The plan's admin field "reward wallet address" becomes the `treasury` shown in AD2, set at deploy to the master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, which is where `withdrawReserve` and `withdrawRewards` pay back to. Conversions and airdrops draw from this one reserve. How much CT to fund at launch is open (section 11).

Weekly ranking: decision. **On chain per week counters plus off chain sorting and an on chain airdrop.** Every credit adds to `weekPoints[weekId][user].points` and stamps `lastCreditAt` in the same slot (about 5,000 gas per credit after the first of the week), so anyone can check a winner's points; sorting stays off chain (the indexer), and `airdrop` verifies that the submitted winners are strictly ordered by their on chain counters. What it cannot prove is that nobody outside the list scored more; that is covered by publishing the full ranking (K1 and AD5) and the airdrop delay. Hit points count in the week of the market's day, not the week of the settle transaction, so Sunday's markets count for the week they were played.

Ties: decided as a strict order, so the contract can verify it and the 10 prizes never need splitting: equal points rank by who reached that total first (earlier `lastCreditAt`), then by the lower address. K1 shows distinct ranks with the note "Tied on points: whoever reached the total first ranks higher." (The spec's earlier default of splitting tied prizes is dropped because it cannot be checked on chain without an unbounded winner list.)

Airdrop timing. Sunday's markets may resolve up to Wednesday 00:00 UTC (48 hour rule) and their hits land `settleDelay` later, so the week's final points are known at Wednesday 06:00 UTC. `airdropDelay` is therefore 60 hours: the airdrop runs Wednesday 12:00 UTC (21:00 KST), and the contract requires `airdropDelay >= RESOLVE_DEADLINE + settleDelay`.

Weekly pool. The plan's "signed up users x 1 CT" becomes **qualified players x 1 CT** (REVIEW B7: registered, not frozen, played 3 or more days that week, account older than 7 days), computed off chain by the worker and passed as `pool`, capped on chain by `maxWeeklyPool` (10,000 CT). Split `splitBps = [3000, 2000, 1500, 1000, 700, 500, 400, 300, 300, 300]` (sums to 10,000). With fewer than 10 eligible players the unpaid share stays in the reserve.

### 3.5 `CojamStaking`

Storage:

```solidity
IERC20 public immutable CT;
struct Position {                       // two slots
    uint128 principal;
    uint128 maxInterest;                // interest reserved at stake time for the full lock
    uint128 claimed;                    // interest paid so far
    uint64  start;
    uint64  end;                        // start + lockDays x 1 days
    uint32  aprBps;                     // snapshot of the rate at stake time
    bool    closed;                     // principal withdrawn
}
mapping(address user => Position[]) private _positions;
mapping(address user => uint256) public openPositions;
uint256 public totalPrincipal;          // CT owed back to stakers
uint256 public totalCommitted;          // sum of (maxInterest - claimed) over open positions
uint16[4] public lockDays = [30, 90, 180, 365];
uint256[2] public tierThresholds = [1_000e18, 10_000e18];
uint32[3][4] public rateBps;            // [lock][tier], see table
uint256 public minStake = 100e18;  uint256 public minClaim = 10e18;  uint256 public maxOpenPositions = 20;
uint256 public maxTotalPrincipal;       // optional cap on all staked CT (0 = no cap)
```

Rate table (from the plan, basis points; tier by the amount of the position being opened):

| Lock | under 1,000 CT | 1,000 to 9,999 CT | 10,000 CT and more |
| --- | --- | --- | --- |
| 30 days | 800 | 900 | 1000 |
| 90 days | 1200 | 1300 | 1400 |
| 180 days | 1800 | 1900 | 2000 |
| 365 days | 2500 | 2600 | 2700 |

Maths (per second, simple interest, no compounding):

```
YEAR = 365 days
earned(p, t)  = p.principal x p.aprBps x (min(t, p.end) - p.start) / (10_000 x YEAR)     // rounded down
claimable(p)  = earned(p, now) - p.claimed
maxInterest   = principal x aprBps x (lockDays x 1 days) / (10_000 x YEAR)              // = earned at end
```

Earned is always computed from `start`, not from the last claim, so repeated claims cannot drift by rounding. Check against the plan: 1,000 CT for 90 days at 13% gives 1000 x 0.13 x 90 / 365 = 32.05 CT ("about 32 CT").

After the lock ends: accrual stops at `end`. The position stays open until the owner withdraws; there is no automatic renewal and no interest after `end` (decided, REVIEW B8). Tier is set by the size of each position, a user may hold up to 20 open positions, and `maxTotalPrincipal` starts at 0 (no cap).

Solvency, the contract never promises interest it does not hold:

```
availableRewards() = CT.balanceOf(this) - totalPrincipal - totalCommitted
stake: requires availableRewards() >= maxInterest, then totalCommitted += maxInterest
claim: totalCommitted -= amount
withdraw at end: pays principal + claimable; releases (maxInterest - earned) rounding dust from totalCommitted
```

So every open position's full interest is reserved in CT at the moment it is opened. When the reward reserve runs low, new stakes revert with `InsufficientRewards(available, needed)` and S1 shows "staking is full for now"; existing positions are unaffected.

Functions:

| Function | Caller | Rules |
| --- | --- | --- |
| `stake(uint256 amount, uint8 lockIndex) returns (uint256 id)` | anyone, not paused | `amount >= minStake`, `lockIndex < 4`, open positions below cap, total cap, reserve check; pulls with `safeTransferFrom` and measures what arrived |
| `claimInterest(uint256 id) returns (uint256)` | position owner | `claimable >= minClaim` (10 CT) while locked, or any amount once the lock has ended (REVIEW B9) |
| `withdraw(uint256 id) returns (uint256 principal, uint256 interest)` | position owner | `now >= end`, not closed; pays principal plus all remaining interest |
| `setRates(uint32[3][4])`, `setTiers`, `setMinimums`, `setCaps` | OWNER | each rate at most 5,000 bps; `minStake` 1 to 100,000 CT; `minClaim` 0 to 1,000 CT; affect new positions only, so no delay needed |
| `withdrawRewards(uint256 amount, address to)` | OWNER | `amount <= availableRewards()`, `to == treasury`; principal and committed interest can never be withdrawn |
| `pause()` / `unpause()` | PAUSER / OWNER | pauses `stake` only. **Claims and withdrawals can never be paused** |

Events: `Staked(user, id, amount, lockDays, aprBps, end, maxInterest)`, `InterestClaimed(user, id, amount)`, `Withdrawn(user, id, principal, interest)`, `RatesSet`, `RewardsWithdrawn(to, amount)`. Views: `positionsOf(user, offset, limit)`, `claimable(user, id)`, `quote(amount, lockIndex) -> (tier, aprBps, interest, end)`, `availableRewards()`.

Invariants: `CT.balanceOf(this) >= totalPrincipal + totalCommitted` at all times; a position pays at most `principal + maxInterest`; principal can only go to its owner and only after `end`; owner functions cannot touch principal or committed interest; rate changes never change an open position.

Early exit is not offered (the plan: "principal withdraws after the lock ends"; decided, REVIEW B8). Staking functions read `msg.sender` only, so a play key can never stake, claim or withdraw.

### 3.6 Parameters and bounds (admin AD2)

| Parameter | Default | Bounds | Where | Change |
| --- | --- | --- | --- | --- |
| `completionPoints` | 100 | 0 to 1,000 | Predict | 48 h delay |
| `hitPoints` | 50 | 0 to 1,000 | Predict | 48 h delay |
| `pointsPerCT` | 1,000 | 100 to 100,000 | Predict | 48 h delay |
| `minConvertPoints` | 1,000 | `pointsPerCT` to 1,000,000 | Predict | 48 h delay |
| `maxConvertCtPerUserPerDay` | 50 CT | 1 to 10,000 | Predict | 48 h delay |
| `maxConvertCtPerDay` (global) | 20,000 CT | 100 to 1,000,000 | Predict | 48 h delay |
| `minAccountAge` (before first conversion) | 7 days | 0 to 30 days | Predict | 48 h delay |
| `settleDelay` | 6 h | 0 to 48 h | Predict | 48 h delay |
| `minResolveGap` | 1 h | 0 to 7 days | Predict | 48 h delay |
| `maxWeeklyPool` | 10,000 CT | 0 to 1,000,000 | Predict | 48 h delay |
| `splitBps[10]` | 30/20/15/10/7/5/4/3/3/3 % | sum 10,000 | Predict | 48 h delay |
| `airdropDelay` | 60 h (Wednesday 12:00 UTC) | `RESOLVE_DEADLINE + settleDelay` to 7 days | Predict | 48 h delay |
| `treasury` | master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb` | not zero | both | 48 h delay |
| `RESOLVE_DEADLINE`, `MAX_PLAY_KEY_TTL` | 48 h, 90 days | constants | Predict | never |
| Rates, tiers, minimums, caps | plan values | 3.5 | Staking | new positions only, immediate |

Off chain settings (server, AD2, immediate): weekly pool per qualified player (1 CT), play key lifetime requested by the PWA (30 days), sponsorship limits (4.8).

### 3.7 Roles and key custody

| Role | Holder | Can | Cannot |
| --- | --- | --- | --- |
| OWNER (`DEFAULT_ADMIN_ROLE` via OZ `AccessControlDefaultAdminRules`, 3 day transfer delay) of both contracts | The master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, an EOA whose key lives only in the founder's wallet apps (DECISIONS). Owner transactions are built by the admin and signed and paid by the master wallet itself, never by a server | Propose and apply params, grant and revoke roles, unpause, unfreeze, set corrected outcomes, withdraw unused reserves to the treasury | Move points, touch staking principal or committed interest |
| OPERATOR | Hot key in `cojam-app-worker` (Render secret), KAIA only | Register players, freeze, create days, set and correct outcomes inside the window, void, compensate (on chain checked), airdrop (on chain checked) | Change params, withdraw CT, unpause, set or use play keys |
| PAUSER | Operator key and the master wallet | Pause new predictions, conversions and stakes | Unpause |
| Fee payer (not a contract role) | Hot key in `cojam-app-api`, KAIA only, separate from the swap fee payer `0xB3CB...52da` so budgets and alerts stay separate | Co-sign allow listed 0x31 transactions | Anything on chain by itself |
| Play key (not a contract role) | One per player, on the player's device (IndexedDB), bound by `setPlayKey`, expires after at most 90 days (30 requested) | `predict` for its player, `revokePlayKey` | Convert, stake, claim, withdraw, hold funds, set another key |

A leaked operator key can at worst: register sybils, freeze players (reversible by the owner), set wrong outcomes (bounded to points; fixable inside the window, compensable after), and run one airdrop per ended week to a ranked list it cannot forge. It cannot take CT except through those capped, rule checked paths. Rotation: owner revokes and grants the role.

### 3.8 Upgradeability: none

Both contracts are immutable, like the token and the swap. Reasons: users stake CT, and an upgrade key over principal is the largest risk a small team could hold; the brand's "listing neutral, no owner powers" stance; a smaller audit. Escape hatches instead: params with bounds and delay, pause of new activity, and a planned successor path. For the prediction contract the successor reads `balanceOf` of the old one and lets each user import their points once (`importPoints`, old contract paused); for staking a new contract is deployed for new positions while old positions run to their end.

---

## 4. Background sending of one transaction per swipe (play key)

The founder decided: one transaction per swipe, sent in the background, the next card shown at once, quiet retries; and the play key (REVIEW A1, DECISIONS). This section is the design for both.

### 4.1 Two signers, no prompt per swipe

| Signer | Signs | How | Nonce sequence |
| --- | --- | --- | --- |
| Play key (local, one per device) | `predict`, `revokePlayKey` | viem local account over the 0x31 SigHash, in a few milliseconds, no network round trip | The play key account's own nonces, used only by this device's outbox |
| Privy embedded wallet | `setPlayKey`, `convert`, CT `approve(staking)`, `stake`, `claimInterest`, `withdraw` (all sponsored), and the user paid CT `transfer` (W4) | `secp256k1_sign` over the 0x31 SigHash (path A), modal off; W4 through `eth_sendTransaction` | The Privy wallet's nonces, used only by the transaction sheet, one action at a time |

Because the two signers are different accounts, predicts and value actions never compete for nonces: a stake started while three picks are in flight needs no coordination with the outbox.

* Privy Dashboard: "Add confirmation modals" off, and `showWalletUIs: false` passed per call as well [7]. The PWA shows its own small "saved" tick per card and its own transaction sheet (SCREEN-SPEC 2.2).
* No session signers (section 1.1).
* Because a modal free wallet and a local key sign whatever our code asks, the PWA's code integrity is the security boundary: strict CSP (`script-src 'self'` plus Privy's documented origins), no third party scripts or analytics tags, subresource integrity on anything external, and each signer builds calls only from a fixed table: the play key `predict` and `revokePlayKey`, the Privy wallet the value actions above. The contract enforces the play key's limit anyway (3.4).

### 4.2 Play key lifecycle

| Step | What happens | Screen state (SCREEN-SPEC) |
| --- | --- | --- |
| Create | After login, if IndexedDB holds no valid key for this player, the PWA generates a key with viem `generatePrivateKey()`. The raw key is stored in IndexedDB encrypted with a non extractable AES-GCM `CryptoKey` (WebCrypto cannot hold secp256k1 keys natively; the wrap stops a plain storage dump from revealing it, not a script running in our origin). The PWA calls `navigator.storage.persist()` | A1 setup panel "Setting up your game" |
| Authorise | The Privy wallet signs a sponsored 0x31 `setPlayKey(key, now + 30 days)`; the setup panel waits for it to be mined (about 1 to 3 s) | Same panel, step "Getting this device ready to play" |
| Use | Every swipe is a 0x31 `predict` sent by the key (4.3) | H1, H2 |
| Renew | On app open, when fewer than 7 days remain, the PWA silently sends a new `setPlayKey` for the same key with a new expiry (one Privy signature, no UI unless it fails) | None; failure shows the H1 banner "We could not reconnect this device." |
| Expire | After `expiresAt` the fee payer refuses the key's predicts with `PLAY_KEY_INVALID`; queued picks wait, the PWA re-authorises, then the picks are signed again | H1 / H2 banner "Reconnecting this device" |
| Storage lost | iOS eviction, reinstall, cleared site data or a new phone: no key on the device. After login the PWA creates a new key; `setPlayKey` replaces the old binding | A1 setup panel "Setting up your game" |
| Replaced by another device | One active key per player, so setting up a second device unbinds the first. The first device learns it from `PLAY_KEY_INVALID` plus `playKeyOf(player) != myKey` and does not re-authorise on its own (that would ping pong between devices) | H1 / H2 panel "Cojam is now set up on another device" with "Play on this device" |
| Revoke | Log out: the key sends `revokePlayKey()` itself (sponsored, no Privy signature), then the PWA deletes it. A frozen player's key stops working because `predict` checks the player | P1 log out |

A pick made while the key is being re-authorised is not lost: it stays `queued` in the outbox and is signed by the new key once `setPlayKey` is mined, as long as its market is still open.

### 4.3 The outbox

Each swipe writes an item to IndexedDB before anything else, then the UI moves on:

```
OutboxItem { id: "predict:<marketId>", kind, args, createdAt, state, signer, nonce?, raw?, txHash?, attempts, lastError?, notAfter }
state: queued -> signing -> sent -> mined | done_elsewhere | failed
signer: the play key address that signed `raw` (a raw signed by a replaced key is discarded and the item re-queued)
notAfter: market.closesAt (a prediction that cannot reach the chain before close is dropped as "not counted")
```

The item id is the idempotency key: a second swipe on the same market cannot create a second item.

One sender loop per play key, guarded by `navigator.locks.request("cojam-outbox:" + playKeyAddress)` so two windows of the app never sign competing nonces. The loop:

1. Take the oldest `queued` item. If the play key is missing, expired or replaced, stop and run the lifecycle step of 4.2.
2. `nonce = max(eth_getTransactionCount(playKey, "pending"), lastNonceUsed + 1)` (0 for a fresh key).
3. Build the 0x31 tx (gas limit from a fixed table per action plus 30%, gas price from `eth_gasPrice` cached 60 s), compute SigHash, sign locally with the play key, attach, encode `senderTxHashRLP`.
4. `POST /v1/tx/sponsor`. The server answers after `kaia_sendRawTransaction` accepted it (not after mining), typically in under 500 ms.
5. On `200 {txHash}`: mark `sent`, remember `lastNonceUsed = nonce`, and go straight to the next item. A separate poller marks `mined` from receipts.

So five quick swipes become five transactions with nonces n to n+4, sent one after another as fast as the server accepts them (local signing adds almost nothing), each accepted by the node before the next is signed. Kaia's 1 second blocks mine them in nonce order.

Value actions do not use the outbox: the transaction sheet sends one Privy signed 0x31 at a time, reads the Privy wallet's `pending` nonce for each, and waits for the receipt before the next step (approve, then stake).

### 4.4 Nonce rules for several transactions in flight

| Situation | What it means for the nonce | Action |
| --- | --- | --- |
| Server refused before broadcast (policy, limits, simulation) | Nonce not used | Next item reuses the same nonce |
| `ALREADY_DONE` (simulation reverted `AlreadyPredicted` with the same choice on chain) | Nonce not used | Item becomes `done_elsewhere`, UI unchanged |
| `PLAY_KEY_INVALID` (key expired, revoked or replaced) | Nonce not used | Pause the loop, run 4.2 (renew, or show "set up on another device"); after a new key is bound, items are signed by it starting at its nonce 0 |
| `BROADCAST_UNCERTAIN` with a hash | Nonce maybe used | Pause the loop; poll the hash and the account nonce for up to 60 s; continue when one of them moves; else resend the identical raw transaction (same hash, so it cannot double) |
| Sent but not mined after 30 s and the account nonce has not passed it | Dropped from the pool | Resend the identical raw transaction once; if still missing at 90 s, re-sign the same payload with the same nonce |
| Mined but reverted | Nonce used | Read the chain: if the choice is stored, done; if `MarketClosed`, failed ("not counted"); if the key was replaced in the meantime, re-queue for the new key; else re-queue with a new nonce |
| Later item mined while an earlier one is stuck | Cannot happen: Kaia executes nonces in order, which is why the loop never signs n+1 before n was accepted | |

The account nonce is the play key's only (the fee payer's nonce is not involved in 0x31, and the Privy wallet's nonces belong to value actions), so the fee payer never serialises users against each other and a key's nonce is touched by one device only.

### 4.5 Idempotency

* PWA: one outbox item per market id.
* Server: the sponsor endpoint caches the `senderTxHash` for 10 minutes (same as `server/`), so the same signed transaction posted twice is broadcast once; it also keeps `(player, marketId)` in `sponsored_txs` and refuses a second sponsored `predict` for the same market with `ALREADY_DONE` when the first was mined, whichever key or wallet sent it.
* Contract: `AlreadyPredicted(marketId)` makes a duplicate revert; the fee payer simulates every call first, so a duplicate is refused before any gas is spent and never reverts on chain at our cost.

### 4.6 Completion reward on the fifth answer

`predict` increments `UserDay.answered`; the call that makes it 5 sets `completed` and credits `completionPoints` to the player in the same transaction (`PointsCredited(kind 1)`, `DayCompleted` derived by the indexer). Because the five transactions execute in nonce order, the fifth to execute is always the one that credits, whatever the order of the swipes. H3 never shows the reward before it is confirmed (REVIEW A4): while any of the five is not yet mined it shows "Saving your picks. 100P follows."; when the fifth is mined and `PointsCredited(kind 1)` is seen it shows "+100P paid", counts the point pill up and fires the toast "+100P paid.". With 1 second blocks the wait is brief. If a predict finally fails, H3 returns to H1 or H2 with that card back as unanswered.

### 4.7 Retry policy (one policy for the plan and the spec, REVIEW A3)

* Automatic, silent: backoff 1, 2, 4, 8, 16, 30 s with jitter, then every 30 s, **until the market closes** (`notAfter`). Before each retry the client reads the chain; a pick already stored counts as confirmed and is not resent. Network loss pauses the loop (`online` event resumes it).
* Surfaced while it keeps failing, without stopping: after 3 failed attempts or 60 s, a small banner on H1/H2 "1 pick is still being saved" (plural "{n} picks are still being saved") with "Retry now".
* The card returns with "Not saved. Pick again." and the toast "Your pick on question {n} was not saved." only for a non retryable failure while the market is still open (an unexpected revert or an unknown error code). After the close it shows "Not saved: the question closed" and does not return.
* On app start the loop resumes any unfinished items.
* Non retryable codes surface at once: `MARKET_CLOSED`, `NOT_REGISTERED`, `FROZEN`, `CHAIN_ID_MISMATCH`. `PLAY_KEY_INVALID` is not a failure: it triggers 4.2 and the item waits.
* If sponsorship is down (`FEE_PAYER_BALANCE_LOW`, `DAILY_BUDGET_EXHAUSTED`), items wait and retry every 60 s until the close; users are never asked to pay for predictions.

### 4.8 Throughput and rate limits at 5 transactions per user per day

| Item | 300 daily players | 3,000 daily players |
| --- | --- | --- |
| Predict transactions a day | 1,500 | 15,000 |
| All sponsored transactions a day (predict, play key authorisation, convert, staking; settle is keeper sent) | about 1,650 | about 16,300 |
| Peak (assume 25% of players in the first 15 minutes after 09:00 KST) | 0.4 tx/s | 4.2 tx/s |
| Fee payer work per tx | decode, 1 to 3 RPC reads (plus `playerOf(key)` for a play key predict, cached until the key's expiry or a `PlayKeySet` event), `eth_estimateGas`, sign, send: about 150 to 400 ms, I/O bound | |
| Instances needed | 1 | 1 (2 for headroom); limits in Postgres so 2 is safe |
| RPC calls per tx | about 4 | 60,000 to 80,000 a day: **a dedicated Kaia RPC provider is required**; the public node rate limits |

Per user and global limits (all configurable):

| Limit | Default | Code |
| --- | --- | --- |
| Sponsored `predict` per player per day (counted on the resolved player, whichever key or wallet sends) | 5 markets, 2 attempts each (10) | `RATE_LIMITED_SENDER` |
| Sponsored `setPlayKey` per player per day | 3 | `RATE_LIMITED_SENDER` |
| Other sponsored calls per wallet per day | 15 | `RATE_LIMITED_SENDER` |
| Same limits per Privy user id (JWT `sub`) where a token is sent | same | `RATE_LIMITED_USER` |
| Per client network (salted IP hash) per day | 300 (mobile carrier NAT) | `RATE_LIMITED_IP` |
| Sponsor requests per player per minute | 20 | `RATE_LIMITED_BURST` |
| Global daily KAIA budget | 3 x the 7 day average spend, at least 10 KAIA | `DAILY_BUDGET_EXHAUSTED` |
| Fee payer balance floor | 10 KAIA | `FEE_PAYER_BALANCE_LOW` |

### 4.9 Gas per swipe and monthly cost (estimate)

Assumptions: gas price 27.5 gkei (node `eth_gasPrice`, 2026-11-12, `docs/FEE-DELEGATION.md`); intrinsic 21,000, plus 10,000 for fee delegated types, plus calldata at 100 gas per byte (the pre Prague Kaia rate; KIP-223 changed calldata pricing at Prague [13], so this is a conservative upper bound); execution from storage writes (20,000 for a new slot, 2,900 to 5,000 for an update, 2,100 per cold read). Measure on Kairos in phase 1.

| Transaction | Calldata | Execution (estimate) | Total gas | KAIA |
| --- | --- | --- | --- | --- |
| `predict` by the play key, first of the day (new `UserDay` slot, plus about 4,500 for the key lookup) | 68 B, 6,800 | 35,500 | about 74,000 | 0.0020 |
| `predict` by the play key, second to fourth | 6,800 | 16,500 | about 55,000 | 0.0015 |
| `predict` by the play key, fifth (completion: balance, supply, week counter, events) | 6,800 | 41,500 to 56,500 | 80,000 to 95,000 | 0.0022 to 0.0026 |
| `setPlayKey` (two new slots, old binding cleared) | 68 B | 45,000 | about 85,000 | 0.0023 |
| Keeper `settleMany`, per user and call in a batch of 100 (per market settle: about 2 calls per user day, because the 5 markets resolve in at most 2 time bands, 6.4) | 32 B | 25,000 | about 28,000 | 0.0008 |
| `convert` (burn, CT transfer, caps) | 36 B | 60,000 | about 95,000 | 0.0026 |
| `approve` CT for staking (once) | 68 B | 25,000 | about 62,000 | 0.0017 |
| `stake` (new position, pull, commit) | 68 B | 120,000 to 150,000 | up to 190,000 | 0.0052 |
| `claimInterest` / `withdraw` | 36 B | 45,000 / 60,000 | 80,000 / 95,000 | 0.0022 / 0.0026 |

Per daily player: 5 predicts about 327,000 gas plus 2 settle calls 56,000 = **about 380,000 gas, 0.0105 KAIA a day**; average per swipe about 65,000 gas, 0.0018 KAIA. Per market settle and the key lookup add about 15% over the first draft.

| Monthly (30 days) | 300 daily players | 3,000 daily players |
| --- | --- | --- |
| Predict and settle gas | 94 KAIA | 940 KAIA |
| Play key authorisations (about 1.5 per MAU a month), conversions, staking, operator txs (5 markets, 5 outcomes, airdrop) | about 7 KAIA | about 61 KAIA |
| Total with a 30% estimate margin | **about 130 KAIA** | **about 1,300 KAIA** |
| In KRW at 40 KRW per KAIA (the pool reference: 5 KAIA per CT, 1 CT = 200 KRW) | about 5,200 KRW | about 52,000 KRW |
| In KRW at 250 KRW per KAIA (if KAIA reprices) | about 32,500 KRW | about 325,000 KRW |
| Privy signatures (play key authorisation about 1.5 per MAU a month, plus about 0.3 value actions per player day; swipes need none) | about 3,600: inside 50,000 | about 36,000: inside 50,000 |
| Privy plan (MAU about 2x daily players) | Core $299 (or Free under 500 MAU) | Scale $499 |
| Claude API (section 6.4) | about $100 to $150 | about $100 to $150 |

With the play key, Privy cost is the plan fee only, and gas stays small. Above about 4,000 daily players the signature allowance (and above 10,000 MAU the plan) is the next limit to watch.

---

## 5. Anti abuse

The main economic risk: many social accounts farming points (converted to CT at 1,000P = 1 CT) and inflating the weekly pool, whose size grows with sign ups. A bot answering at random earns on average 100 + 2.5 x 50 = 225P a day per account, about 6.75 CT (about 1,350 KRW) a month, and costs us its gas and its Privy MAU on top.

Proposed measures, proportionate to a points product:

| # | Measure | Where | Cost to honest users |
| --- | --- | --- | --- |
| 1 | Registration gate: a wallet earns only after the operator registers it; registration happens on first login after checks (Privy account verified, one embedded wallet per Privy user, provider allow list, no duplicate device fingerprint cluster above a threshold) | Contract `registerPlayer`, API | None visible |
| 2 | Sponsorship tied to the Privy JWT: the fee payer only co-signs when the bearer's embedded wallet equals the transaction sender | API | None |
| 3 | Account age before first conversion (`minAccountAge` 7 days) and per user and global daily conversion caps | Contract | A week's wait for the first CT |
| 4 | Pool size counts **qualified players**, not sign ups: registered, not frozen, played at least 3 days in that week, account older than 7 days; and the pool is capped (`maxWeeklyPool`) | Worker + contract cap | None |
| 5 | Risk scoring job: clusters by IP hash, device hash, sign up bursts, identical answer sequences, timing patterns; flagged accounts lose sponsorship and can be frozen (never debited) | Worker, AD1 / AD5 | False positives: unfreeze path by owner |
| 6 | Airdrop winners reviewed by rule: frozen or flagged accounts skipped, next rank moves up | Worker, `airdrop` checks `frozen` | None |
| 7 | Prefer providers with stronger identity: Kakao (phone backed) and LINE (phone backed) for KR and JP, Google and Apple; avoid X, Discord, Telegram at launch | Privy Dashboard | Slightly fewer login choices |

Need a founder decision (section 11): the registration gate and the freeze power; the qualified player definition and the pool cap; the 7 day wait before first conversion and the caps; which providers; whether flagged accounts keep sponsorship.

---

## 6. Server and jobs

### 6.1 Services

* `cojam-app-api` (web): REST API, fee payer, admin API. Stateless, 1 to 2 instances.
* `cojam-app-worker` (background worker): indexer, pg-boss jobs (operator transactions, AI pipeline, risk scoring, monitors). Exactly one instance, because it owns the operator key's nonce.

### 6.2 API

Auth: user endpoints take `Authorization: Bearer <Privy access token>` (verified with Privy's verification key; the user's embedded wallet comes from Privy's user record, cached). Admin endpoints take a token from the separate admin Privy app, plus an allow list of admin user ids and MFA. Public endpoints are CORS limited to `app.cojam.app`, `admin.cojam.app`.

| Endpoint | Purpose | Auth | Screens |
| --- | --- | --- | --- |
| `GET /v1/config` | Network, chain id, contract addresses, params, `minAppVersion`, feature flags | public | all |
| `GET /v1/health` (`?strict=1`) | Liveness, RPC, DB, fee payer balance, indexer lag | public | ops |
| `POST /v1/session` | First login bootstrap: creates the user row, queues `registerPlayer`, returns registration state | user | A1, A2 |
| `GET /v1/me` | Profile, wallet, registration, language, stats | user | P1 |
| `PATCH /v1/me` | Language, display name masking choice | user | P1 |
| `GET /v1/today` | Day id, opens and next open time, 5 markets in the user's language, the user's choices (chain plus pending) | user | H1, H2, H3 |
| `GET /v1/results?cursor=` | Past days: outcome, user choice, hits, pending or credited, evidence link | user | R1 |
| `GET /v1/markets/:id` | One market with sources and resolution evidence summary | user | R1 |
| `GET /v1/ranking/week/:weekId` (`current`) | Pool, top 10 (masked), the user's rank and gap to 10th | user | K1 |
| `GET /v1/wallet` | CT, KAIA, points, pending hit points, conversion preview and caps left | user | W1, W2 |
| `GET /v1/wallet/history?cursor=` | Deposits, conversions, airdrops, staking, withdrawals from the index | user | W1 |
| `GET /v1/staking/quote?amount&lock` | Tier, rate, interest, KRW value, capacity left | user | S1 |
| `GET /v1/staking/positions` | Positions with claimable interest | user | S2 |
| `POST /v1/tx/sponsor` `{rawTransaction}` | Policy check, simulate, co-sign, broadcast, return `{txHash, action}` | user | all writes |
| `GET /v1/tx/:hash` | Status, decoded result | user | all writes |
| `GET /admin/v1/dashboard` | Players, daily actives, completion rate, points issued and converted, reserves and runway, gas spend, AI status | admin | AD1 |
| `GET/POST /admin/v1/params` | Current and pending on chain params; builds unsigned `proposeParams` / `applyParams` transactions for the owner wallet to sign | admin | AD2 |
| `GET /admin/v1/questions?status=` | Drafts, scheduled, live, resolved; per question the AI rationale, sources, translations | admin | AD3 |
| `POST /admin/v1/questions/:id/cancel`, `/replace` | Pull a scheduled question before it is published on chain (no approval step, only a veto) | admin | AD3 |
| `GET /admin/v1/answers?status=` | Resolutions with evidence, confidence, both AI runs, correction window countdown | admin | AD4 |
| `POST /admin/v1/answers/:marketId/rerun` | Re-run resolution | admin | AD4 |
| `POST /admin/v1/answers/:marketId/correct` | Inside the window: `correctOutcome`; after it: prepares `setCorrectedOutcome` for the owner and a compensation batch | admin | AD4 |
| `GET /admin/v1/ranking/:weekId`, `POST .../airdrop` | Full ranking, eligibility, planned split; trigger or retry the airdrop job | admin | AD5 |
| `GET /admin/v1/players?flag=`, `POST .../freeze` | Risk flags, freeze (operator), prepare unfreeze (owner) | admin | AD5 |
| `GET /admin/v1/system` | Fee payer and operator balances and runway, budgets, job queue, indexer lag, RPC, Claude usage and cost, audit log | admin | AD6 |

### 6.3 Fee payer policy (new allow list, `platform/api/src/feeDelegation/policy.ts`)

Same pipeline as `server/`: decode 0x31 only, one sender signature recovering to `from`, chain id, value 0, canonical calldata, gas caps, simulate with `eth_estimateGas` from the sender, atomic reservation, co-sign, broadcast, settle the real fee. Plus: `from` must equal the bearer's Privy embedded wallet.

| Target | Selector | Extra checks | Gas cap |
| --- | --- | --- | --- |
| CojamPredict | `predict(uint256,uint8)` | market is today's, open, not answered (simulation), player registered | 150,000 |
| CojamPredict | `settle(address,uint32)` | `user == from` | 150,000 |
| CojamPredict | `convert(uint256)` | multiple of rate, caps left (simulation) | 200,000 |
| CT | `approve(address,uint256)` | spender == CojamStaking | 120,000 |
| CojamStaking | `stake(uint256,uint8)` | amount >= minStake | 300,000 |
| CojamStaking | `claimInterest(uint256)`, `withdraw(uint256)` | position owner == from (simulation) | 200,000 |

Never sponsored: CT `transfer` (W4 user paid withdrawal), any owner or operator function, any other contract or selector, any type other than 0x31. Gas price cap 50 gkei.

### 6.4 AI pipeline (questions and answers)

Model: `claude-opus-5-5` through the Anthropic TypeScript SDK, adaptive thinking (effort `medium` for drafting and translation, `high` for resolution), `web_search_20260209` and `web_fetch_20260209`, structured output schemas, server side fallbacks enabled. Every call is logged in `ai_runs` with prompt version, model id, token usage and cost.

Drafting rules (the system prompt and a code validator both enforce them):

* Binary, objective, with one named public resolution source and a second independent source; resolution criteria stated in one sentence with exact time and timezone.
* `closesAt` must be before anything relevant is knowable: for discrete events at most the event start minus 10 minutes; for continuous values (prices, rates) the question compares two fixed future instants and closes at least 12 hours before the first one is observed, or the gap `resolvesAt - closesAt` is at least 12 hours.
* Expected probability between 25% and 75% (no near certain questions), resolvable within 48 hours of close.
* Categories (default mix per day): Crypto 2, Sports 1, Markets / economy 1, Tech / culture 1 (founder to confirm, 11.13). Excluded: elections and politics, wars and violence, disasters, health of named people, private individuals, crimes, anything involving CT or Cojam's own pool, low liquidity tokens anyone could move, adult content, gambling odds.
* No duplicate of the last 30 days (embedding free check: normalized text plus entity and date match).
* Text: question at most 90 characters in EN, choice labels at most 12 characters (fits the card), category chip from a fixed list.

Schedule (UTC; KST = UTC+9):

| Time | Job |
| --- | --- |
| Daily 02:00 | Draft 12 candidates for day D+2 with web search (fresh news and calendars) |
| Daily 02:30 | Validate (second Claude call with a fresh context and the rules as a checklist, plus code checks), deduplicate, select 5 by category mix; translate the 5 into KO and JA (Claude, glossary from `site/assets/i18n.js` terms); store as `scheduled` |
| Daily 12:00 | Publish day D+1 on chain: `createDay(D+1, 5 markets)`; retries every 15 min; alert if not mined by 18:00; at 22:00 fall back to the reserve pool of evergreen questions prepared weekly |
| Every 5 min | Resolution sweep: markets with `resolvesAt` passed and no outcome |
| Every 10 min | Settle sweep: days whose 5 outcomes are past `settleDelay`: `settleMany` in batches of 100 for all players of that day |
| Every 15 min | Correction check: second resolution run for outcomes still inside the window |
| Monday 00:05 | Close the week in the index; Tuesday 12:00 run `airdrop` once the settle backlog for the week is zero |
| Hourly | Risk scoring; registration queue every minute |
| Every minute | Monitors (balances, lag, budgets) |

Resolution:

1. Data adapters first where the source is structured (for example a crypto close price from two exchange APIs); the AI is the cross check.
2. Claude run 1: fetch the named sources only (`allowed_domains` set to the question's source domains), return `{outcome: "A"|"B"|"undeterminable", confidence 0..1, evidence: [{url, quote, observedAt}], reasoning_summary}`.
3. Claude run 2, independent: different prompt order, may use the secondary source. Both runs and the adapter must agree, with confidence at least 0.9 each.
4. Agreement: `setOutcome`. Evidence (quotes, URLs, fetched text hash, timestamps) stored in `resolutions` and `evidence`, shown on R1 and AD4.
5. Disagreement or "undeterminable": retry every hour up to 24 hours after `resolvesAt`, then up to 48 hours with alerts; after 48 hours `voidMarket` (no hit points for anyone on that market; completion points are unaffected). Event postponed or cancelled: void.
6. Inside the settle window a third run checks each outcome again; a disagreement triggers `correctOutcome` only if two of three runs plus the adapter agree on the other answer; otherwise it alerts and waits.

Compensation tool (AD4): an admin marks a settled market as wrong; the worker computes users whose on chain choice equals the true outcome, prepares `setCorrectedOutcome` for the owner to sign, then runs `compensate` batches with the operator key. Every step is in `audit_log`.

Prompt injection through sources: fetched pages are data. The system prompt says so; tools are limited to allow listed domains per question; outputs are constrained to the schema (an outcome enum and quotes), and code verifies each quote appears in the stored fetched text. The model cannot call anything that writes: the worker decides from the validated JSON. Two independent runs and the data adapter must agree.

### 6.5 Indexer

Polls `eth_getLogs` every 2 s for both contracts and CT transfers to and from known player wallets (deposits W3 and withdrawals W4), from the deploy blocks, in ranges that shrink on node refusal (as in `server/src/keeper.js`). Kaia has immediate finality, so one confirmation is enough. It writes to Postgres in one transaction per range together with the cursor, so a restart resumes exactly. The whole index can be rebuilt from logs.

### 6.6 Monitoring and alerts (Sentry, Telegram, email)

| Alert | Threshold |
| --- | --- |
| Fee payer or operator runway | under 14 days, or balance under 2 x floor |
| Sponsorship error rate | above 5% over 10 min, or any `sponsored tx reverted on chain` |
| Outbox failures reported by clients | above 2% of predicts per hour |
| Day not on chain | 18:00 UTC for the next day |
| Outcome missing | 6 h after `resolvesAt` |
| Void rate | more than 1 market in 7 days |
| Settle backlog | any day past `settleDelay + 1 h` with unsettled players |
| Indexer lag | above 30 blocks |
| Reserves | conversion reserve under 14 days of conversions plus the next pool; staking `availableRewards` under 30 days of expected new commitments |
| Risk | sign up burst above 5x the 7 day hourly average |
| Privy | login error rate above 5% |
| Claude | API errors, refusals, monthly spend above budget |

---

## 7. Data model

Source of truth:

| Data | Source of truth | Off chain copy |
| --- | --- | --- |
| Points balances, credits, conversions | Chain (CojamPredict) | Index for lists and ranking |
| Predictions and outcomes | Chain | Index |
| Market text, translations, sources, evidence | Postgres (hash on chain) | Public on R1 and AD4 |
| Week counters | Chain | Index sorted for K1 |
| Airdrop payments | Chain | Index |
| Staking positions | Chain | Index |
| User profile, language, login provider, risk flags | Postgres | |
| Sponsorship usage, limits, budgets | Postgres | |
| AI runs, audit log | Postgres | |

Tables (Postgres):

| Table | Key columns |
| --- | --- |
| `users` | `id`, `privy_user_id` unique, `wallet` unique, `provider`, `language`, `display_mask`, `created_at`, `registered_tx`, `registered_at`, `frozen`, `risk_score` |
| `markets` | `market_id` pk, `day_id`, `slot`, `category`, `question` jsonb {en, ko, ja}, `choice_a`, `choice_b` jsonb, `closes_at`, `resolves_at`, `sources` jsonb, `criteria`, `content_hash`, `status` (draft, scheduled, published, closed, resolved, voided, corrected), `outcome`, `create_tx`, `outcome_tx` |
| `market_drafts` | `id`, `target_day`, `payload` jsonb, `validator_result` jsonb, `selected`, `rejected_reason`, `ai_run_id` |
| `resolutions` | `id`, `market_id`, `run` (1, 2, 3, adapter), `outcome`, `confidence`, `reasoning`, `ai_run_id`, `created_at` |
| `evidence` | `id`, `resolution_id`, `url`, `quote`, `observed_at`, `fetched_text_sha256`, `fetched_text` (compressed) |
| `predictions` | `(wallet, market_id)` pk, `choice`, `tx_hash`, `block`, `status` |
| `user_days` | `(wallet, day_id)` pk, `answered`, `completed`, `settled`, `hits`, `completion_points`, `hit_points` |
| `points_ledger` | `id`, `wallet`, `kind` (completion, hits, compensation, convert), `amount`, `day_id`, `week_id`, `tx_hash`, `log_index` unique |
| `week_totals` | `(week_id, wallet)` pk, `points`, `last_credit_block` |
| `weeks` | `week_id` pk, `qualified_players`, `pool`, `airdrop_tx`, `status` |
| `airdrop_rows` | `(week_id, rank)` pk, `wallet`, `points`, `amount`, `skipped_reason` |
| `conversions` | `tx_hash` pk, `wallet`, `points`, `ct` |
| `stakes` | `(wallet, position_id)` pk, `principal`, `lock_days`, `apr_bps`, `start`, `end`, `claimed`, `closed` |
| `wallet_transfers` | `tx_hash, log_index` pk, `wallet`, `direction` (in, out), `counterparty`, `amount` |
| `sponsored_txs` | `sender_tx_hash` pk, `wallet`, `privy_user_id`, `action`, `market_id`, `tx_hash`, `status`, `reserved_wei`, `actual_wei`, `error_code`, `ip_hash`, `created_at` |
| `usage_daily` | `(day, key)` pk, `count`, `spent_wei` (rate limits and budget) |
| `ai_runs` | `id`, `job`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd`, `stop_reason`, `created_at` |
| `risk_flags` | `id`, `wallet`, `rule`, `score`, `details` jsonb, `status` |
| `admin_users` | `privy_user_id` pk, `role` (viewer, operator, owner), `added_by` |
| `audit_log` | `id`, `actor`, `action`, `target`, `payload` jsonb, `tx_hash`, `created_at` (append only) |
| `chain_cursor` | `name` pk, `block` |
| `pgboss.*` | job queue schema |

---

## 8. Security, self audit, tests

### 8.1 Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Fee payer key leak | KAIA only, 30 days of runway at most, daily budget, separate from the swap fee payer; later KMS signing (as `docs/FEE-DELEGATION.md` section 6) |
| Operator key leak | Bounded powers (3.7), every write checked on chain, alerts on any operator tx not initiated by a job, owner revokes the role |
| Owner key compromise | Safe multisig (recommended), 48 h param delay gives time to react, owner cannot touch principal or points |
| Relayer or fee payer abuse (draining gas) | Allow list, JWT bound sender, simulation before signing, per wallet, per user, per IP and global limits, balance floor |
| Replay | 0x31 carries the user nonce and chain id; the server caches sender hashes; path B intents carry deadlines and nonces, `predict` is idempotent by market |
| Answer front running (predicting after the outcome is knowable) | Contract rejects predictions at or after `closesAt`; drafting rules put `closesAt` before any information; `resolvesAt >= closesAt + minResolveGap`; outcomes are set only after close, so a pending `setOutcome` cannot be raced |
| Wrong AI answer | Two runs plus adapter, settle delay as correction window, compensation verified on chain |
| Prompt injection through sources | 6.4: data only, domain allow list, schema output, quote verification, no write tools |
| Modal free signing abused by injected script | Strict CSP, no third party scripts, SRI, fixed call table in the outbox, dependency pinning and `npm audit` in CI |
| Admin account takeover | Separate Privy app for admin, allow list, MFA, every action in `audit_log`, owner actions need the owner wallet anyway |
| Sybil farming | Section 5 |
| Reserve exhaustion | Reverts instead of overdraw, runway alerts, staking reserves interest at stake time |
| RPC outage | Two providers with failover, health checks, outbox keeps items |
| Privy outage | Outbox keeps items; reads work from the index; status banner |
| Data loss | Render Postgres daily backups plus point in time recovery; index rebuildable from chain |

### 8.2 Self audit checklist (before mainnet)

* [ ] Every external function: access control, `nonReentrant` where CT moves, checks then effects then interaction, measured pulls.
* [ ] Every loop bounded by a batch cap; no unbounded array growth read in a write path.
* [ ] All casts with `SafeCast`; packed fields cannot overflow over 100 years of days.
* [ ] Bounds and delays on every param; events on every state change the indexer needs.
* [ ] Fuzz invariants of 3.4 and 3.5 hold for 10,000 runs x 200 steps.
* [ ] `pause` cannot block claims, withdrawals or settle.
* [ ] No function can move points between users; transfer family reverts.
* [ ] Reserve math: owner withdrawals can never reach principal or committed interest.
* [ ] Time math: dayId, weekId, `closesAt` edges at exact boundaries.
* [ ] Slither clean or every finding explained; storage layout and gas report recorded.
* [ ] Fee payer allow list tests: every non listed selector, target, type and oversized gas refused.
* [ ] CSP and SRI checked in production headers; no secret in any client bundle.
* [ ] Key map recorded in `contracts/deployments/wallets.platform.json` (addresses only).
* [ ] External audit (question 11.21).

### 8.3 Test plan

| Level | What | Tool |
| --- | --- | --- |
| Contract unit | Every function, role, error, boundary time, param bound | Hardhat + chai (as `contracts/test/`) |
| Contract fuzz | Random sequences of predict, outcome, correct, settle, compensate, convert, airdrop, stake, claim, withdraw with time jumps; invariants | `test/platform/fuzz.test.js` in the existing `FUZZ_RUNS` style |
| Fork | Against mainnet CT on a Kaia fork: funding, conversions, staking with real token behaviour | `fork.kaia.test.js` pattern |
| Gas | Report per function; feeds 4.9 | `REPORT_GAS=true` |
| API unit | Policy, decoding, limits, idempotency, JWT binding | `node:test` / Vitest with mocked RPC (as `server/test`) |
| AI pipeline | Golden set of 50 past questions with known answers; replay resolution; measure agreement and void rate; injection fixtures | Vitest + recorded fixtures |
| PWA | Outbox state machine (all rows of 4.4, and the play key lifecycle of 4.2) with a fake node; i18n completeness; gesture tests | Vitest + Playwright |
| E2E on Kairos | Real Privy logins on iPhone and Android, installed PWA, 5 swipes in under 10 s, airplane mode mid swipe, kill app mid outbox, day rollover, conversion, staking full cycle with a 1 hour lock test build | Playwright for desktop parts, manual script for devices, `tools/e2e/` pattern |
| Soak | 14 real daily cycles on Kairos with 20 to 30 testers | Phase 5 |

---

## 9. Environments and deploy

### 9.1 Networks

| Env | Chain | CT | Purpose |
| --- | --- | --- | --- |
| local | Hardhat | mock CT | development |
| kairos | 1001 | test CT deployed by `scripts/platform/deploy-kairos.js` | spike, beta |
| kaia | 8217 | `0x91cb3B346C80ff965a9667ba6228834dbedD71a2` | production |

The PWA picks the network from build time config, with `?net=kairos` only in non production builds.

### 9.2 Render services to add (`render.yaml`, at build time; the existing three stay untouched)

| Service | Type | Root | Domain | Notes |
| --- | --- | --- | --- | --- |
| `cojam-app` | static | `platform/app/dist` (build `npm ci && npm run build -w app`) | `app.cojam.app` | headers: CSP, HSTS, `sw.js` and `manifest.webmanifest` `no-cache`, hashed assets immutable; SPA rewrite to `/index.html` |
| `cojam-admin` | static | `platform/admin/dist` | `admin.cojam.app` | `X-Robots-Tag: noindex` |
| `cojam-app-api` | web, Node 20, Singapore, Starter | `platform` | `app-api.cojam.app` | `npm run start -w api`, health `/v1/health` |
| `cojam-app-worker` | worker, Node 20, Singapore, Starter, 1 instance | `platform` | none | `npm run worker -w api` |
| `cojam-app-db` | Postgres 16, Basic | | | backups on |
| `cojam-ops` (existing) | cron | `contracts` | | new `OPS_TASK=deploy-platform` for the mainnet deploy, same manual trigger and `CONFIRM_MAINNET` pattern |

### 9.3 Environment variables (names only)

API and worker: `NODE_ENV`, `NETWORK`, `CHAIN_ID`, `KAIA_RPC_URL`, `KAIA_RPC_URL_FALLBACK`, `DATABASE_URL`, `CT_ADDRESS`, `PREDICT_ADDRESS`, `PREDICT_DEPLOY_BLOCK`, `STAKING_ADDRESS`, `STAKING_DEPLOY_BLOCK`, `ALLOWED_ORIGINS`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY`, `PRIVY_ADMIN_APP_ID`, `PRIVY_ADMIN_APP_SECRET`, `ADMIN_ALLOWLIST`, `APP_FEE_PAYER_PRIVATE_KEY` (api only), `OPERATOR_PRIVATE_KEY` (worker only), `ANTHROPIC_API_KEY` (worker only), `AI_MODEL` (`claude-opus-5-5`), `AI_MONTHLY_BUDGET_USD`, `MAX_GAS_PRICE_GKEI`, `SPONSOR_PREDICT_PER_DAY`, `SPONSOR_OTHER_PER_DAY`, `SPONSOR_IP_PER_DAY`, `SPONSOR_BURST_PER_MIN`, `DAILY_BUDGET_KAIA`, `MIN_FEE_PAYER_BALANCE_KAIA`, `MIN_OPERATOR_BALANCE_KAIA`, `IP_HASH_SALT`, `SENTRY_DSN`, `ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID`, `ALERT_EMAIL`, `TRUST_PROXY`.

Static builds: `VITE_NETWORK`, `VITE_API_URL`, `VITE_PRIVY_APP_ID`, `VITE_SENTRY_DSN`, `VITE_SWAP_URL` (`https://cojam.app/migrate/`), `VITE_RELEASE`.

### 9.4 PWA install Gate (G1) logic

```
standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
if admin route                    -> not this app
else if standalone                -> A1 / H1 flow
else if ?preview=<signed token>   -> allowed for design review only (non production builds)
else                              -> G1 Gate:
     Android Chrome / Edge with beforeinstallprompt  -> "Install" button
     iOS Safari                                       -> Share, Add to Home Screen steps with images
     iOS other browsers / in app browsers (KakaoTalk, LINE, Instagram) -> "Open in Safari" instructions
     desktop                                          -> QR code to app.cojam.app, plus the swap link
     always                                           -> link to the swap at cojam.app
```

The manifest uses `display: standalone`, `start_url: /?source=pwa`, `scope: /`, brand colours `#124CC4` theme, icons from `brand/logo/cojam-mark.svg` on a light tile (the mark needs a light ground at small sizes). In app browsers are detected by user agent because Google OAuth fails there [9].

### 9.5 Release and rollback

* Contracts: Kairos deploy, full E2E, then mainnet through `cojam-ops` with `CONFIRM_MAINNET=yes`, Sourcify verify, addresses into `contracts/deployments/platform.kaia.json` and `platform/shared`. No rollback: pause new activity and ship a successor (3.8).
* API and worker: Render auto deploy from `main` after CI; rollback with Render's previous deploy. DB migrations forward only, expand then contract, never a destructive change in the same release.
* PWA: `vite-plugin-pwa` prompt mode: a new version shows "Update ready"; `GET /v1/config` returns `minAppVersion`, and an older client forces reload. Rollback: redeploy the previous static build (hashed assets keep old clients working).
* Release checklist: changelog, `VITE_RELEASE` and Sentry release, smoke test on an installed device, monitors green for 30 minutes.

---

## 10. Milestones

| Phase | Work | Acceptance criteria |
| --- | --- | --- |
| 0. Spike (1 week) | Minimal installed PWA with Privy on Kairos; `secp256k1_sign` of a 0x31 SigHash; the existing fee payer code co-signs; Kakao custom OAuth; Privy billing question; Kaiascan token display of a soulbound stub | All 8 items of 1.4 recorded with evidence (tx hashes, device videos, latency numbers, Privy's written answer). Decision recorded: path A or path B |
| 1. Contracts (2 weeks) | CojamPredict, CojamStaking, tests, fuzz, gas report, Kairos deploy, verify | 100% function coverage, invariants pass at 10,000 x 200, measured gas replaces 4.8, Sourcify exact match on Kairos |
| 2. API, fee payer, indexer, jobs (2 weeks, parallel with 3) | Endpoints of 6.2, policy of 6.3, indexer, operator jobs, monitors, Postgres schema | Fee payer refuses every non listed call in tests; index rebuild from block 0 equals live index; operator jobs idempotent under restart |
| 3. PWA (3 weeks) | G1 to P1 per the screen spec, outbox, i18n EN / KO / JA, service worker | 5 swipes in under 10 s all mined on Kairos; airplane mode and app kill recover; Lighthouse PWA installable; i18n keys complete in 3 languages |
| 4. AI pipeline and admin (2 weeks) | Drafting, validation, translation, resolution with evidence, compensation tool; AD0 to AD6 | Golden set: 0 wrong outcomes set, void rate under 5%; 7 consecutive days published automatically on Kairos; every admin action in the audit log |
| 5. Kairos beta (2 weeks) | 20 to 30 testers, real daily cycles, two weekly airdrops, staking with a test build of short locks | 14 days without manual chain intervention; measured gas and Privy signatures per player; no P1 bugs open; self audit checklist complete |
| 6. Mainnet | Deploy, fund reserves, register founders, soft launch, then public | Contracts verified; reserves funded per founder plan; monitors live; rollback plan rehearsed |

---

## 11. Open questions for the founder

1. **Privy cost at scale.** One transaction per swipe means about 5 Privy signatures per player per day; above 50,000 a month Developer plans charge $0.01 each (about $4,270 a month at 3,000 daily players), Enterprise "from $0.001". Accept, negotiate Enterprise early, or revisit after Privy confirms whether client side raw signatures are billed?
2. **Login providers.** Proposed: Google, Apple, LINE (native), Kakao (custom OAuth). Add or drop any (X, Telegram, Discord)? Is email login excluded entirely?
3. **Day boundary.** New set at 00:00 UTC = 09:00 KST / JST, week from Monday 09:00 KST. Confirm, or prefer midnight KST?
4. **Missed days.** A day's unanswered markets expire at the day's end and cannot be caught up later. Confirm.
5. **Hit points delay.** Hits credited about 6 hours after the answer (the correction window), shown as "pending +50P" before that. Confirm the 6 hours.
6. **Anti abuse package (section 5):** registration gate and the operator's freeze power; 7 days before the first conversion; conversion caps (50 CT per user per day, 20,000 CT global); flagged accounts lose sponsorship. Accept each?
7. **Weekly pool.** Count "qualified players" (played 3+ days that week, account 7+ days old) instead of all sign ups, and cap the pool (default 10,000 CT)? Tie rule for equal points: earlier last credit ranks higher, or split the two prizes?
8. **Staking rules.** Tier by the amount of each position (not the user's total)? No interest after the lock ends and no auto renewal? No early exit at all, or early exit with forfeited interest? A cap on total staked CT?
9. **User paid withdrawal (W4).** Users need KAIA in their app wallet to withdraw CT. Accept that (W3 explains how to deposit KAIA), or add a small router contract that is sponsored and takes the fee in CT?
10. **Owner custody.** Kaia Safe multisig (recommended) or an EOA like the master? Who holds the pauser phone wallet?
11. **Reward wallet and funding.** Use the master wallet or a new reward wallet as treasury? How much CT to fund at launch for conversions and airdrops, and for staking interest (staking reserves each position's full interest up front)?
12. **Admin veto.** Answers and questions are fully automatic. May admins still cancel a scheduled question or trigger a correction (as designed in AD3 and AD4), or should the admin be read only?
13. **Question categories and banned topics.** Default mix Crypto 2, Sports 1, Markets 1, Tech / culture 1, with politics, elections and violence excluded. Change?
14. **Question translations.** Daily questions are machine translated into KO and JA by Claude without human review (UI copy is human reviewed per DECISIONS). Acceptable?
15. **Voided markets.** A void gives no hit points to anyone and does not affect the 100P completion reward. Confirm.
16. **Rate changes notice.** Economic params change after a 48 hour on chain delay. Enough?
17. **Display names on K1.** Masked Privy name or short wallet address? Can users choose?
18. **Domains.** `admin.cojam.app` and `app-api.cojam.app` acceptable?
19. **Points on the explorer.** Show points as a soulbound "CJP" token on Kaiascan (recommended), or keep them as an internal ledger?
20. **Beta.** Who are the 20 to 30 Kairos testers, and how long should the beta run (default 2 weeks)?
21. **External audit.** Self audit only (as for the swap), or a paid external audit before mainnet given that staking holds user principal?
22. **Gas budget.** Approve the daily sponsorship budget (default 3 x the 7 day average, at least 10 KAIA) and the fee payer top up size (30 days of runway).

---

## 12. Sources

1. Privy, Sign a raw hash (`secp256k1_sign`, platforms, warning about intended use): https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-raw-hash
2. Privy API reference, secp256k1 sign: https://docs.privy.io/api-reference/wallets/ethereum/secp256k1-sign
3. Privy, Chain support tiers (EVM at Tier 3, raw signing on any supported curve): https://docs.privy.io/wallets/overview/chains
4. Privy, Configuring EVM networks (`supportedChains`, `defineChain`, RPC overrides): https://docs.privy.io/basics/react/advanced/configuring-evm-networks
5. Privy, Signers overview (server side actions through the enclave): https://docs.privy.io/wallets/using-wallets/signers/overview
6. Privy, Policies overview (method list, default deny): https://docs.privy.io/controls/policies/overview
7. Privy, Manage wallet UIs (`showWalletUIs`, Dashboard confirmation modals, security note): https://docs.privy.io/recipes/react/manage-wallet-UIs
8. Privy pricing (plans, MAU, signatures, overage): https://privy.io/pricing
9. Privy, OAuth login methods (native providers including LINE, in app browser warning): https://docs.privy.io/authentication/user-authentication/login-methods/oauth
10. Privy, Custom OAuth providers: https://docs.privy.io/authentication/user-authentication/login-methods/custom-oauth
11. Kaia docs, Fee delegation (SigRLP, SenderTxHashRLP, signature examples): https://docs.kaia.io/build/transactions/fee-delegation/
12. Kaia docs, Gas abstraction introduction (whitelisted ERC-20 only): https://docs.kaia.io/build/tutorials/ga-tutorial/ga-intro/
13. Kaia docs, Hard fork history (Prague at block 190,670,000 on 2025-07-17 with EIP-7702 / KIP-228 and KIP-223 calldata pricing): https://docs.kaia.io/misc/kaia-history/
14. KIP-228, SetCode for EOA: https://kips.kaia.io/KIPs/kip-228
15. Monad docs, Next.js + Serwist + Privy embedded wallet PWA template: https://docs.monad.xyz/templates/next-serwist-privy-embedded-wallet
16. Auth0 community, social login from an iOS home screen PWA opens Safari and does not return: https://community.auth0.com/t/login-to-pwa-on-ios-using-social-identity-provider/18109
17. WebKit blog, Full third party cookie blocking and more (home screen web apps count days of use separately): https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
18. Privy, Server side access recipe (signers): https://docs.privy.io/recipes/wallets/session-signer-use-cases/server-side-access
19. In repository: `docs/FEE-DELEGATION.md` (fee payer pipeline, gas price measurement, format check on mainnet), `server/src/policy.js`, `@kaiachain/js-ext-core` type definitions (`sigRLP`, `addSenderSig`, `senderTxHashRLP`).
