# cojam-app-worker

The background worker of the Cojam Daily Prediction platform. Same package as the API (`platform/api`), started with `npm run start:worker` (`src/worker/main.ts`). It holds the operator key and is the only process that sends operator transactions, so it runs as **exactly one instance**: a Postgres advisory lock makes a second instance exit at start.

Sources of truth: `docs/platform/DECISIONS.md` (later rows win), the contract code in `contracts/contracts/platform/`, then `docs/platform/DEV-PLAN.md`.

## 1. What runs

| Part | Code | Cadence (UTC) | Does |
| --- | --- | --- | --- |
| Indexer | `src/indexer/` | loop, every 2 s | `eth_getLogs` for CojamPredict, CojamStaking and CT transfers of known players, from the deploy block; one Postgres transaction per range with the cursor (`chain_cursor` row `indexer:main`); range shrinks when the node refuses it |
| Registration queue | `src/jobs/registration.ts` | loop, every 10 s | `registerPlayers` for `registration_requests` kind `register` (with the inviter when given), then `setReferrers` for kind `set_referrer` (inside the 24 hour window); every entry is checked on chain first so a bad one never reverts the batch; then a sign up risk check on the new accounts and their cluster |
| Freezes | `src/risk/check.ts` `processFreezes` | loop, every 10 s | `setFrozenMany` for queued `freezes` rows (risk check or admin block and unblock); admin `clear` rows close the review entry; unblock and clear set the 30 day mark (`users.risk_clear_until`) |
| Admin requests | `src/jobs/requests.ts` | loop, every 10 s | `operator_requests`: `resolve_rerun`, `correct_outcome`, `void_market`, `compensate`, `airdrop`, `image_regenerate`, `image_fallback`, `question_replace`, `risk_signup` |
| Alert delivery | `src/worker/alerts.ts` | loop, every 30 s | sends new `worker_alerts` rows through the sinks |
| `draft` | `src/jobs/ai.ts`, `src/ai/draft.ts` | 02:00 and 08:00 | for every day from D+1 to D+`DRAFT_HORIZON_DAYS` with fewer than 5 questions: one drafting call (12 candidates, EN, KO and JA written natively), code checks, a fresh context validation per candidate, selection of 5 by category mix, `markets` rows `scheduled` with their content hash; then images |
| `images` | `src/ai/images.ts` | 03:30 | images for scheduled questions still `pending` (category illustration today, see 4) |
| `publish` | `src/jobs/markets.ts` `publishDay` | every 15 min, 12:00 to 23:45 | `createDay(D+1)`; from 22:00 missing slots are filled from the day's reserve drafts; alert from 18:00 |
| `publish-late` | same | every 15 min | safety net: `createDay` for today if it is missing (the contract accepts a late day until 1 hour before its end) |
| `resolution` | `src/jobs/markets.ts`, `src/ai/resolve.ts` | every 5 min | markets past `resolvesAt` without an outcome: two independent AI runs (and a data adapter when one exists) must agree with confidence 0.9 and verified quotes, then `setOutcome`; both say cancelled: void; otherwise retry hourly and void 40 hours after the day end |
| `correction` | same | every 15 min | one re-check inside the settle window; a disagreement gets a second re-check; `correctOutcome` only when both re-checks agree on the other answer, else an alert |
| `settle` | same | every 10 min | `settleMany` (batches of `SETTLE_BATCH`) for every player with a final, unsettled slot |
| `expiry` | same | every 10 min | `voidExpired` for anything past day end + 48 h (should never happen; critical alert first) |
| `compensation` | `src/jobs/compensation.ts` | every 10 min | after the owner recorded a corrected outcome on chain: `compensate` batches for players whose pick equals it |
| `week-close` | `src/jobs/weekly.ts` | Monday 00:05 | marks the ended week closed (`weeks.status`) |
| `airdrop` | same | every 15 min | from `weekEnd + airdropDelay` (Wednesday 12:00 UTC, 21:00 KST) once the week's backlog is empty: pool = qualified players x 1 CT, capped at 10,000 CT and the on chain `maxWeeklyPool`; winners by points, then earlier last completion, then lower address, re-read from chain; accounts on hold skipped, ranks below move up |
| `risk` | `src/risk/` | hourly, and at every sign up (queue `risk-signup`) | scores accounts active in 14 days; 80 and above: queued freeze; 50 and above: review list (`risk_flags` open) |
| `monitors` | `src/jobs/monitors.ts` | every minute | `app_state` snapshots for the API (params, reserves, balances, indexer status, AI usage, job status) and the standing alerts of DEV-PLAN 6.6 |

Scheduled jobs run on pg-boss (schema `pgboss`), one queue per job with policy `exclusive` (never two runs at once, no pile up), no retries (the next tick is the retry). The schedule is in `src/jobs/schedule.ts`. Loop and job status: `app_state` key `worker.jobs`.

## 2. Contracts with the API

* **Choices**: `left` is choice A (outcome 1, the no, down or under side), `right` is choice B (outcome 2). Outcome 3 is void.
* **Content hash** (`src/ai/contentHash.ts`): `keccak256(utf8(canonical JSON of {en, ko, ja: {title, left, right, rule}, closesAt, resolvesAt, sources: [{name, url}]}))`, keys sorted, no whitespace, strings NFC and trimmed, times in unix seconds, primary source first. The settle phrase and the image are not hashed. `publishDay` recomputes it from the stored text, so an admin edit before publish is hashed as edited.
* **Category illustrations**: `markets.image_key` is `fallback/q1-bitcoin.svg` (Crypto, alternating with `fallback/q5-kaia.svg`), `fallback/q2-dollar-won.svg` (Markets), `fallback/q3-seoul-weather.svg` (Weather), `fallback/q4-football.svg` (Sports), or null for Culture (the card draws the category icon). The PWA serves these from its bundle (copied from `platform/design/assets/img/`).
* **Queues the API writes**: `registration_requests` (status `queued`), `freezes` (status `queued`, actor = admin email), `operator_requests` (status `queued`), pg-boss queue `risk-signup` with `{ wallets: [...] }` (optional: registration triggers it too).
* **Worker tables** (`src/db/migrations/0900_worker_tables.sql`): `worker_operator_txs` (one row per operator transaction: job, method, args, nonce, hash, status, decoded revert name, gas, fee), `worker_alerts`, `worker_compensations` (from `Compensated` events), plus `markets.observes_at`, `markets.kind` and `users.email_shape_hash`.
* **`users.email_shape_hash`** must be written by the API at sign up for the look alike rule: `HMAC(EMAIL_HASH_KEY, domain + ':' + localPartShape(normalisedLocal))` with `localPartShape` from `src/risk/rules.ts`. Without it the rule never fires.
* **Airdrop rows**: paid ranks 1 to 10; accounts skipped because they are on hold are stored with rank 100 + n and `skipped_reason` ("frozen: would have been rank 6").

## 3. Environment variables (names only)

Shared with the API (parsed in `src/config/index.ts`): `NODE_ENV`, `LOG_LEVEL`, `NETWORK`, `CHAIN_ID`, `KAIA_RPC_URL`, `KAIA_RPC_URL_FALLBACK`, `DATABASE_URL`, `CT_ADDRESS`, `PREDICT_ADDRESS`, `PREDICT_DEPLOY_BLOCK`, `STAKING_ADDRESS`, `STAKING_DEPLOY_BLOCK`, `MAX_GAS_PRICE_GKEI`, `MIN_OPERATOR_BALANCE_KAIA`, `MIN_FEE_PAYER_BALANCE_KAIA`, `RISK_BLOCK_SCORE`, `RISK_REVIEW_SCORE`, `EMAIL_HASH_KEY`, `IP_HASH_SALT`.

Worker secrets: `OPERATOR_PRIVATE_KEY` (Render secret, never on the API), `ANTHROPIC_API_KEY` (without it AI is disabled: no drafting, no answers, alerts fire).

Worker settings: `AI_MODEL` (default `claude-opus-5-5`), `AI_ENABLED` (`0` turns AI off), `AI_MONTHLY_BUDGET_USD`, `DRAFT_HORIZON_DAYS` (2), `DRAFT_CANDIDATES` (12), `SETTLE_BATCH` (100, max 200), `REGISTER_BATCH` (100, max 200), `COMPENSATE_BATCH` (300, max 500), `WEEKLY_POOL_PER_PLAYER_CT` (1), `WEEKLY_POOL_CAP_CT` (10000), `OPERATOR_TX_TYPE` (`legacy` default, or `eip1559`), `INDEXER_RANGE` (2000), `INDEXER_CONFIRMATIONS` (0), `APP_FEE_PAYER_ADDRESS` (address only, for the balance monitor).

Alerts: `ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID` (Telegram sink), `ALERT_EMAIL` (email sink, a stub that logs until a mail provider is chosen).

Images (not used yet, the model is open): `IMAGE_API_KEY`, `IMAGE_MODEL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGE_BASE_URL`.

## 4. What is stubbed or not built

* **Image generation**: only `CategoryIllustrationGenerator` exists. The pipeline around it is built and tested with a fake generator: Claude writes the prompt from the fixed template, the vision check rejects text, people, logos and badly placed subjects, up to 2 regenerations, then the category illustration. Adding a model means one `ImageGenerator` and one `ImageStore` (R2).
* **Data adapters** for structured sources (exchange prices): the interface is in `src/ai/resolve.ts`, none ships. With none, the two AI runs decide.
* **Email alerts**: stub sink. Telegram sink is a thin `sendMessage` call, not tested against the Bot API.
* **Evergreen reserve pool** of the plan: not built. The reserve is the day's own accepted, unselected drafts (12 written, 5 used).
* **Sentry**: not wired in the worker.

## 5. Tests

`npm run test:worker` (vitest). Pure: winners and tie break (against the contract rule, plus a randomized comparison), pool, risk scoring and identical answer detection, every drafting code check (times, weekend rule, text limits, dash rule, numbers across languages, topics, sources, duplicates), selection, content hash, resolution and correction decisions, quote verification, the Anthropic provider's request shape (stubbed SDK). Integration (need Postgres at `TEST_PG_URL`, default `postgres://cojam:cojam@localhost:5432/postgres`, and the compiled contracts in `contracts/artifacts`): the AI pipeline on Postgres with the fake provider, and a compressed day on a local Hardhat node with the real contracts (register with inviter and late code, draft, publish, predict, risk freeze, set outcomes, correct inside the window, settle, owner correction and compensation, week close and airdrop with a frozen top player skipped, late day creation, monitors, index rebuild equality, sender serialization, simulation reverts and crash recovery).

Manual: `npx tsx test/worker/helpers/smoke-main.ts` boots the real entry against a local node for 25 s. `npm run ai:dry-run -- --day 2026-12-03` drafts and validates one day with the real API when `ANTHROPIC_API_KEY` is set (fake provider otherwise); `--resolve market.json` runs one resolution pair. Nothing is written.

## 6. Runbook

Alerts are rows in `worker_alerts` (open while `resolved_at` is null) and go to Telegram. Keys below; `:N` is a day, market or week id.

| Alert key | Meaning | Do |
| --- | --- | --- |
| `operator-balance` | Operator under 2x the floor (critical under the floor; sends stop at half the floor) | Send KAIA to the operator address from the treasury |
| `fee-payer-balance` | API fee payer under 2x the floor | Top up the fee payer (API service) |
| `indexer-lag` | Index more than 30 blocks behind | Check RPC (`KAIA_RPC_URL`, fallback), the worker log `loop indexer failed`; a long outage catches up by itself |
| `loop-failing:<name>` | A loop failed 10 times in a row | Read the worker log for that loop; RPC or database most often |
| `draft-short:D`, `day-incomplete:D` | A day has fewer than 5 questions | Look at `market_drafts.rejected_reason` for the day (AD3). Replace with `operator_requests` `question_replace` or wait for the 08:00 catch up; at 22:00 the reserve fills; `ai-errors` often explains it |
| `day-not-on-chain:D` | 18:00 and tomorrow is not on chain | Check `worker_operator_txs` for `createDay` (`sim_reverted` with `error_name`); `BadTimes` means a stored time is outside the contract rules |
| `day-late:D` | A day opened without questions and was published late | Players who came early saw no questions; find why `publish` missed (worker down, RPC) |
| `day-missed:D` | A day was never published (last hour passed) | Nothing to send any more; say so in the app's status if needed |
| `outcome-missing:M`, `outcome-late:M` | No answer 6 h after due, again 36 h after the day end | AD4: read both runs in `resolutions` and `evidence`. Re-run (`resolve_rerun`) or void (`void_market`). At 40 h the worker voids by itself |
| `recheck-disagrees:M` | The re-check disagrees with the set answer inside the window | Decide before `settles_at`: `correct_outcome` inside the window costs nothing; after it only the owner can record a correction and players are compensated |
| `corrected:M` | The worker corrected an answer inside the window | Informational; check the evidence |
| `market-voided:M`, `void-rate` | A market was voided; more than 1 in 7 days | Review the question source choice in drafting |
| `settle-backlog` | A final market has unsettled players an hour later | Check `worker_operator_txs` for `settleMany` errors and the operator balance |
| `expired:M` | A market passed the 48 h deadline | `voidExpired` is sent automatically; find out why resolution never ran |
| `airdrop-backlog:W` | The airdrop waits for unresolved or unsettled picks | Clear the backlog (above); or force with `operator_requests` kind `airdrop`, payload `{ weekId, force: true }` |
| `airdrop-reserve:W` | The prediction reserve cannot pay the pool | Fund CojamPredict with CT from the master wallet; the airdrop retries every 15 min |
| `airdrop-failed:W` | The airdrop transaction failed | Read `error_name` in `worker_operator_txs` (`BadWinners`, `Frozen`: a winner was frozen between building and sending; the next run rebuilds) |
| `risk-freezes:<hour>` | Accounts were blocked automatically | Review in AD7; unblock writes a `freezes` row `unfreeze` |
| `risk-review-list` | More than 50 accounts wait for review | Work through AD7 |
| `registration-failing` | Registrations failed 5 times | `registration_requests.error`; usually RPC or operator balance |
| `owner:<tx>:<event>` | Any owner action on chain (params, roles, reserve withdrawals, treasury, corrected outcome) | Confirm the founder did it; if not, the master key is compromised |
| `ai-errors`, `ai-budget` | Claude API failures or refusals; monthly spend over budget | `ai_runs.error`; budget: raise `AI_MONTHLY_BUDGET_USD` or lower `DRAFT_CANDIDATES` |
| `images-pending` | A question of the next two days has no image decision | Run `image_fallback` for it |
| `reserve-runway` | Prediction reserve under 14 days of conversions plus a full pool | Fund CojamPredict |

Common operations:

* **Stuck operator transaction**: rows with status `sent` in `worker_operator_txs`. The sender rebroadcasts and bumps the gas price (+20%, up to the cap); a restart runs `recover()` (mined, dropped or rebroadcast). Never send from the operator key by hand while the worker runs: it owns the nonce.
* **Rebuild the index**: suspend the worker, run `npx tsx src/indexer/rebuild-cli.ts --yes` with the worker's environment, resume the worker.
* **Rotate the operator key**: the owner grants `OPERATOR_ROLE` (and `PAUSER_ROLE`) to the new address and revokes the old one, then update `OPERATOR_PRIVATE_KEY` and restart.
* **Turn AI off** (incident or budget): `AI_ENABLED=0` and restart. Publishing, settling, airdrops and risk keep running; drafting and answers stop and their alerts fire.
