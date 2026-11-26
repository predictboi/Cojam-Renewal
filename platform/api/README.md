# @cojam/app-api

The web API (`cojam-app-api`) and the background worker (`cojam-app-worker`) of Cojam Daily Prediction, one package with two start commands. Endpoints are documented in [API.md](API.md); the plan is `docs/platform/DEV-PLAN.md` (sections 4 to 9) as amended by `docs/platform/DECISIONS.md`.

Stack: Node 20, Fastify 5, TypeScript run by `tsx` (no build step), zod, Postgres 16 with Kysely and plain SQL migrations, viem, `@kaiachain/js-ext-core` for Kaia's 0x31 RLP, `@privy-io/node` for access tokens, pg-boss and the Anthropic SDK for the worker.

## Layout

| Path | Owner | What |
| --- | --- | --- |
| `src/server/` | API | `main.ts` (entry), `app.ts` (Fastify factory), `errors.ts`, `limits.ts` (Postgres counters), `hash.ts` |
| `src/routes/` | API | `public.ts`, `session.ts`, `play.ts`, `wallet.ts`, `invite.ts`, `tx.ts`, `admin.ts`, `common.ts` |
| `src/auth/` | API | Privy verification, the dev bypass, admin roles and the operations agent service token |
| `src/feeDelegation/` | API | `decode.ts` (0x31 decode, recover, co-sign), `policy.ts` (static allow list, gas caps, revert mapping), `service.ts` (the sponsorship pipeline) |
| `src/db/` | API (shared) | `migrations/*.sql`, `types.ts` (Kysely types for every table), `index.ts` (`createDb`, `audit`, `getState`), `migrate.ts`, `seed.ts` |
| `src/config/` | API (shared) | zod env parsing for both services (`loadConfig(env, "api" | "worker")`) |
| `src/chain/` | API (shared) | viem clients, raw `kaia_*` RPC, typed reads (`ChainReader`), `devStub.ts` |
| `src/worker/`, `src/indexer/`, `src/jobs/`, `src/ai/`, `src/risk/` | worker | see the worker's notes |
| `platform/shared/src/` | shared | `errors.ts` (every error code), `api.ts` (response types of every user endpoint), `email.ts`, `invite.ts`, `time.ts` |

## How the API and the worker meet

The API never sends operator transactions. It writes rows the worker consumes:

| Table | Written by the API when | Worker action |
| --- | --- | --- |
| `registration_requests` (`register`) | `POST /v1/session` passed the sign up checks; `referrer` set when a valid code came along (also updated by a later redeem while still `queued`) | `registerPlayers(wallets, referrers)`, then set `users.registration`, `registered_at`, `registered_tx` |
| `registration_requests` (`set_referrer`) | `POST /v1/invite/redeem` (or a code on `POST /v1/session`) after registration, inside 24 h | `setReferrers` |
| `freezes` (`freeze` / `unfreeze`, status `queued`) | admin block / unblock (block also sets `users.frozen = true` at once, so sponsorship stops before the chain catches up) | `setFrozen(wallet, bool, reason)`; the indexer sets `users.frozen` from `PlayerFrozen` |
| `operator_requests` | admin: `question_replace`, `void_market`, `image_regenerate`, `image_upload_check`, `resolve_rerun`, `correct_outcome`, `compensate` (after the owner signed `setCorrectedOutcome`), `airdrop` | the matching job |

Index conventions the read endpoints rely on: a market is shown to players once its `status` is `published` (set when `DayCreated` is mined) or later (`closed`, `resolved`, `voided`, `corrected`); `outcome`, `resolved_at` and `settles_at` mirror `OutcomeSet`; `image_url` (or `image_key` under `IMAGE_BASE_URL`) is the card image and `<key without extension>.thumb.webp` the thumbnail; `points_ledger.day_id` and `week_id` come from `PointsCredited` (and the day of `ReferralPaid` / `WelcomePaid`); `week_totals.last_completion_at` is the block time of the player's last completion credit that week (the tie break); `users.registered_at` is the block time of `PlayerRegistered` (it starts the 24 hour invite window).

The worker writes snapshots the API reads from `app_state` (keys in `STATE_KEYS`, `src/db/index.ts`): CojamPredict params, reserves, balances, indexer status, staking params, job summary, Claude usage. Every read endpoint also works without them (live chain reads or defaults).

## Run locally

Postgres 16 must be running. In this container it is installed from apt and started with `service postgresql start`; the role and databases used below were created with:

```
su postgres -c "psql -c \"create user cojam with password 'cojam' superuser;\" -c 'create database cojam_dev owner cojam;'"
```

Then:

```
cd platform/api
npm install
cp .env.example .env            # AUTH_DEV_BYPASS=1 is already set for local work
npm run dev:seed                # migrates and fills a plausible day (today, yesterday resolved, tomorrow scheduled)
DEV_CHAIN=stub npm run dev:api  # offline chain: no Kaia node or contracts needed
```

With `DEV_CHAIN=stub` the API reads players, keys and points from Postgres and "mines" sponsored transactions at once (predict, setPlayKey, revokePlayKey, convert), so the PWA can run end to end. Without it the API reads Kairos (`NETWORK=kairos`, addresses from `platform/shared/addresses/kairos.json`).

Dev identities (only with `AUTH_DEV_BYPASS=1`, which `loadConfig` refuses when `NODE_ENV=production`; `DEV_CHAIN=stub` likewise):

* Player: header `X-Dev-User: minji` instead of a Privy token. The wallet is derived from the name (`devIdentity`, `devWalletKey` in `src/auth/privy.ts`), the email is `<name>@gmail.com` unless the name contains `@`.
* Admin: header `X-Dev-Admin: dev@cojam.app` (seeded as owner).
* `npx tsx scripts/dev-play.ts minji http://localhost:8080` authorises a play key and answers today's five markets through `/v1/tx/sponsor`.

## Tests

```
npm test            # API and worker suites
npm run test:api    # API only (101 tests)
npm run typecheck
```

The API tests use a real Postgres: `test/globalSetup.ts` migrates a template database once per run (unique name per run) and every test file clones it, so files run in parallel. Set `TEST_PG_URL` (default `postgres://cojam:cojam@localhost:5432/postgres`; the role needs `CREATEDB`). The chain, the RPC and Privy are stubs (`test/api/helpers.ts`). `kaia-encoding.test.ts` proves our 0x31 sender and fee payer signatures are byte identical to `@kaiachain/ethers-ext`, the encoder proven on mainnet and in the spike.

## Deploy (Render, later)

* `cojam-app-api`: web service, root `platform/api` (needs `platform/shared` in the checkout), build `npm ci`, start `npm run start:api`, health check `/v1/health`. Migrations run on start (advisory lock, safe with the worker starting at the same time).
* `cojam-app-worker`: `npm run start:worker`, one instance.
* Env names: `.env.example` lists all of them. Secrets only in Render: `PRIVY_APP_SECRET`, `PRIVY_ADMIN_APP_SECRET`, `APP_FEE_PAYER_PRIVATE_KEY` (API only), `OPERATOR_PRIVATE_KEY` (worker only), `ANTHROPIC_API_KEY`, `EMAIL_HASH_KEY`, `IP_HASH_SALT`, `ADMIN_SERVICE_TOKEN_SHA256`, the R2 keys. `loadConfig` refuses the operator key on the API and the fee payer key on the worker.
* Operations agent token: `npx tsx scripts/make-service-token.ts` prints a token once and its SHA-256 (see API.md, "Operations agent").
