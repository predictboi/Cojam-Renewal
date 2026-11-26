-- Cojam Daily Prediction: initial schema (DEV-PLAN section 7, adjusted to docs/platform/DECISIONS.md).
-- Conventions:
--   * Wallet and key addresses are stored lower case (0x + 40 hex).
--   * Token amounts in base units (wei, 18 decimals) are numeric(78,0); points are bigint (0 decimals).
--   * day_id / week_id / market_id follow platform/shared/src/time.ts (dayId = unix / 86400, marketId = dayId * 5 + slot).
--   * Index tables (filled by the worker's indexer) carry tx_hash / block so the whole index can be rebuilt from logs.
--   * Forward only: never edit a migration that has run anywhere; add a new file.

-- ---------------------------------------------------------------- players

CREATE TABLE users (
  id                  bigserial PRIMARY KEY,
  privy_user_id       text NOT NULL UNIQUE,
  wallet              text UNIQUE,                       -- Privy embedded wallet (lower case); null until Privy reports one
  email_domain        text,                              -- normalised domain (googlemail.com folded into gmail.com)
  email_hash          text,                              -- HMAC(EMAIL_HASH_KEY, normalised address), hex
  device_id_first     text,
  ip_hash_first       text,
  language            text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ko', 'ja')),
  onboarded           boolean NOT NULL DEFAULT false,
  display_name        text,
  registration        text NOT NULL DEFAULT 'pending' CHECK (registration IN ('pending', 'registered', 'refused')),
  refusal_reason      text,
  registered_tx       text,
  registered_at       timestamptz,                       -- block time of PlayerRegistered (starts the 24 h invite window)
  frozen              boolean NOT NULL DEFAULT false,    -- mirror of Player.frozen (indexer), also set optimistically by the API on block
  frozen_reason       text,
  risk_score          integer NOT NULL DEFAULT 0,
  risk_clear_until    timestamptz,
  pending_invite_code text,                              -- a code given before registration (bound by registerPlayer)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- One normalised address is one player among registered (or pending) players. Refused rows do not hold the address.
CREATE UNIQUE INDEX users_email_hash_active ON users (email_hash) WHERE registration <> 'refused' AND email_hash IS NOT NULL;
CREATE INDEX users_created_at ON users (created_at);
CREATE INDEX users_device ON users (device_id_first);
CREATE INDEX users_ip ON users (ip_hash_first);

-- Queue of operator transactions about players, consumed by the worker's registration job (every 10 s).
--   kind register      -> registerPlayers(wallets, referrers)   (referrer null = no inviter)
--   kind set_referrer  -> setReferrers(players, referrers)      (code redeemed after registration, inside 24 h)
-- status: queued -> sent -> mined | failed. The API inserts; the worker updates.
CREATE TABLE registration_requests (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('register', 'set_referrer')),
  wallet      text NOT NULL,
  referrer    text,
  invite_code text,
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'mined', 'failed', 'cancelled')),
  attempts    integer NOT NULL DEFAULT 0,
  tx_hash     text,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX registration_requests_open ON registration_requests (wallet, kind) WHERE status IN ('queued', 'sent');
CREATE INDEX registration_requests_status ON registration_requests (status, created_at);

-- Invite codes: 7 characters from A-Z (no O, I, L... see shared invite rules) and 2-9; one per player, never changes.
CREATE TABLE invites (
  code        text PRIMARY KEY,
  wallet      text NOT NULL UNIQUE,
  enabled     boolean NOT NULL DEFAULT true,
  links_today integer NOT NULL DEFAULT 0,
  links_day   integer,                                   -- day_id links_today counts for
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  invitee      text PRIMARY KEY,
  inviter      text NOT NULL,
  code         text,
  source       text NOT NULL CHECK (source IN ('session', 'first_run', 'profile')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  bound_tx     text,
  bound_at     timestamptz,
  first_day_at timestamptz,
  welcome_tx   text,
  welcome_points bigint NOT NULL DEFAULT 0,
  bonus_points bigint NOT NULL DEFAULT 0
);
CREATE INDEX referrals_inviter ON referrals (inviter, requested_at DESC);

CREATE TABLE freezes (
  id          bigserial PRIMARY KEY,
  wallet      text NOT NULL,
  action      text NOT NULL CHECK (action IN ('freeze', 'unfreeze', 'clear')),
  actor       text NOT NULL,                             -- 'risk-check' or the admin email
  reason_code text,
  reason      text,
  rules       jsonb,
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'mined', 'failed', 'done')),
  tx_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX freezes_wallet ON freezes (wallet, created_at DESC);
CREATE INDEX freezes_status ON freezes (status) WHERE status IN ('queued', 'sent');

CREATE TABLE play_keys (
  key         text PRIMARY KEY,
  wallet      text NOT NULL,
  expires_at  timestamptz NOT NULL,
  set_tx      text,
  revoked_tx  text,
  replaced_by text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX play_keys_wallet ON play_keys (wallet, created_at DESC);

-- ---------------------------------------------------------------- sign up checks

CREATE TABLE email_domains (
  domain       text PRIMARY KEY,
  display_name text NOT NULL,
  rule         text NOT NULL DEFAULT 'plus' CHECK (rule IN ('gmail', 'plus', 'none')),
  enabled      boolean NOT NULL DEFAULT true,
  added_by     text NOT NULL DEFAULT 'migration',
  added_at     timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_checks (
  id         bigserial PRIMARY KEY,
  email_hash text,
  domain     text,
  ip_hash    text,
  device_id  text,
  result     text NOT NULL,                              -- allowed, domain_not_allowed, invalid, rate_limited_*
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_checks_ip ON auth_checks (ip_hash, created_at);
CREATE INDEX auth_checks_device ON auth_checks (device_id, created_at);
CREATE INDEX auth_checks_email ON auth_checks (email_hash, created_at);

-- ---------------------------------------------------------------- markets and AI

CREATE TABLE markets (
  market_id     bigint PRIMARY KEY,                      -- day_id * 5 + slot once published; drafts keep the planned id
  day_id        bigint NOT NULL,
  slot          smallint NOT NULL CHECK (slot BETWEEN 0 AND 4),
  category      text NOT NULL,
  content       jsonb NOT NULL,                          -- {en, ko, ja}: each {title, left, right, rule, settle}
  closes_at     timestamptz NOT NULL,
  resolves_at   timestamptz NOT NULL,
  sources       jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{name, url, role: primary|secondary}]
  criteria      text,
  rationale     text,                                    -- AI drafting rationale (admin only)
  content_hash  text,
  image_key     text,
  image_url     text,
  image_sha256  text,
  image_state   text NOT NULL DEFAULT 'fallback' CHECK (image_state IN ('generated', 'fallback', 'replaced', 'rejected', 'pending')),
  image_prompt  text,
  image_model   text,
  status        text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'cancelled', 'published', 'closed', 'resolved', 'voided', 'corrected')),
  outcome       smallint CHECK (outcome BETWEEN 1 AND 3),
  corrected_outcome smallint CHECK (corrected_outcome BETWEEN 1 AND 2),
  resolved_at   timestamptz,
  settles_at    timestamptz,
  create_tx     text,
  outcome_tx    text,
  replaced_by   bigint,
  draft_id      bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX markets_day ON markets (day_id, slot);
CREATE INDEX markets_status ON markets (status);

CREATE TABLE ai_runs (
  id             bigserial PRIMARY KEY,
  job            text NOT NULL,
  model          text NOT NULL,
  prompt_version text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(12, 6),
  stop_reason    text,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_drafts (
  id               bigserial PRIMARY KEY,
  target_day       bigint NOT NULL,
  payload          jsonb NOT NULL,
  validator_result jsonb,
  selected         boolean NOT NULL DEFAULT false,
  rejected_reason  text,
  ai_run_id        bigint REFERENCES ai_runs (id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_drafts_day ON market_drafts (target_day);

CREATE TABLE image_runs (
  id             bigserial PRIMARY KEY,
  market_id      bigint NOT NULL,
  model          text,
  prompt         text,
  result         text NOT NULL CHECK (result IN ('accepted', 'rejected', 'error')),
  reject_reasons jsonb,
  cost_usd       numeric(12, 6),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX image_runs_market ON image_runs (market_id);

CREATE TABLE resolutions (
  id          bigserial PRIMARY KEY,
  market_id   bigint NOT NULL,
  run         text NOT NULL CHECK (run IN ('1', '2', '3', 'adapter', 'admin')),
  outcome     text NOT NULL CHECK (outcome IN ('A', 'B', 'undeterminable', 'void')),
  confidence  numeric(5, 4),
  reasoning   text,
  ai_run_id   bigint REFERENCES ai_runs (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resolutions_market ON resolutions (market_id, created_at);

CREATE TABLE evidence (
  id                  bigserial PRIMARY KEY,
  resolution_id       bigint NOT NULL REFERENCES resolutions (id) ON DELETE CASCADE,
  url                 text NOT NULL,
  quote               text,
  observed_at         timestamptz,
  fetched_text_sha256 text,
  fetched_text        bytea                               -- gzip
);
CREATE INDEX evidence_resolution ON evidence (resolution_id);

-- ---------------------------------------------------------------- chain index (worker indexer)

CREATE TABLE predictions (
  wallet     text NOT NULL,
  market_id  bigint NOT NULL,
  day_id     bigint NOT NULL,
  choice     smallint NOT NULL CHECK (choice IN (1, 2)),
  answered   smallint,                                   -- the player's answer count after this pick (Predicted.answered)
  tx_hash    text NOT NULL,
  block      bigint NOT NULL,
  block_time timestamptz,
  status     text NOT NULL DEFAULT 'mined',
  PRIMARY KEY (wallet, market_id)
);
CREATE INDEX predictions_market ON predictions (market_id);
CREATE INDEX predictions_day ON predictions (day_id);

CREATE TABLE user_days (
  wallet            text NOT NULL,
  day_id            bigint NOT NULL,
  answered          smallint NOT NULL DEFAULT 0,
  completed         boolean NOT NULL DEFAULT false,
  completed_at      timestamptz,
  settled_mask      smallint NOT NULL DEFAULT 0,
  hits              smallint NOT NULL DEFAULT 0,
  completion_points bigint NOT NULL DEFAULT 0,
  hit_points        bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet, day_id)
);
CREATE INDEX user_days_day ON user_days (day_id);

CREATE TABLE points_ledger (
  id            bigserial PRIMARY KEY,
  wallet        text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('completion', 'hits', 'compensation', 'referral', 'welcome', 'convert')),
  amount        bigint NOT NULL,                         -- negative for convert
  source_wallet text,
  day_id        bigint,
  week_id       bigint,
  ranked        boolean NOT NULL DEFAULT false,
  tx_hash       text NOT NULL,
  log_index     integer NOT NULL,
  block         bigint,
  block_time    timestamptz,
  UNIQUE (tx_hash, log_index)
);
CREATE INDEX points_ledger_wallet ON points_ledger (wallet, id DESC);
CREATE INDEX points_ledger_week ON points_ledger (week_id) WHERE ranked;

CREATE TABLE week_totals (
  week_id            bigint NOT NULL,
  wallet             text NOT NULL,
  points             bigint NOT NULL DEFAULT 0,
  last_completion_at timestamptz,                        -- tie break: equal points, earlier last completion first (null last)
  last_credit_block  bigint,
  PRIMARY KEY (week_id, wallet)
);
CREATE INDEX week_totals_rank ON week_totals (week_id, points DESC, last_completion_at ASC NULLS LAST, wallet);

CREATE TABLE weeks (
  week_id           bigint PRIMARY KEY,
  qualified_players integer,
  pool              numeric(78, 0),                      -- CT base units
  airdrop_tx        text,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'airdrop_pending', 'airdropped', 'failed')),
  closed_at         timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE airdrop_rows (
  week_id        bigint NOT NULL,
  rank           smallint NOT NULL,
  wallet         text NOT NULL,
  points         bigint NOT NULL,
  amount         numeric(78, 0),
  skipped_reason text,
  tx_hash        text,
  PRIMARY KEY (week_id, rank)
);

CREATE TABLE conversions (
  tx_hash    text PRIMARY KEY,
  wallet     text NOT NULL,
  points     bigint NOT NULL,
  ct         numeric(78, 0) NOT NULL,
  block      bigint,
  block_time timestamptz
);
CREATE INDEX conversions_wallet ON conversions (wallet);

CREATE TABLE stakes (
  wallet         text NOT NULL,
  position_id    integer NOT NULL,
  principal      numeric(78, 0) NOT NULL,
  lock_index     smallint NOT NULL,
  lock_days      integer NOT NULL,
  apr_bps        integer NOT NULL,
  max_interest   numeric(78, 0) NOT NULL,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  claimed        numeric(78, 0) NOT NULL DEFAULT 0,
  closed         boolean NOT NULL DEFAULT false,
  stake_tx       text,
  withdraw_tx    text,
  PRIMARY KEY (wallet, position_id)
);

CREATE TABLE wallet_transfers (
  tx_hash      text NOT NULL,
  log_index    integer NOT NULL,
  wallet       text NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('in', 'out')),
  counterparty text NOT NULL,
  amount       numeric(78, 0) NOT NULL,
  kind         text NOT NULL DEFAULT 'transfer',          -- transfer, convert, airdrop, stake, interest, withdraw
  block        bigint,
  block_time   timestamptz,
  PRIMARY KEY (tx_hash, log_index, wallet)
);
CREATE INDEX wallet_transfers_wallet ON wallet_transfers (wallet, block DESC);

CREATE TABLE chain_cursor (
  name       text PRIMARY KEY,
  block      bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- sponsorship (API)

CREATE TABLE sponsored_txs (
  sender_tx_hash text PRIMARY KEY,
  sender         text NOT NULL,                           -- play key or wallet that signed
  wallet         text,                                    -- resolved player
  privy_user_id  text,                                    -- null for play key predicts sent without a token
  action         text NOT NULL,
  target         text,
  market_id      bigint,
  nonce          bigint,
  tx_hash        text,
  status         text NOT NULL CHECK (status IN ('reserved', 'broadcast', 'uncertain', 'mined', 'reverted', 'released', 'rejected')),
  reserved_wei   numeric(78, 0) NOT NULL DEFAULT 0,
  actual_wei     numeric(78, 0),
  error_code     text,
  ip_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sponsored_txs_wallet ON sponsored_txs (wallet, created_at DESC);
CREATE INDEX sponsored_txs_tx ON sponsored_txs (tx_hash);
CREATE INDEX sponsored_txs_market ON sponsored_txs (wallet, market_id) WHERE action = 'predict';
CREATE INDEX sponsored_txs_status ON sponsored_txs (status) WHERE status IN ('broadcast', 'uncertain');

-- Counters for rate limits and budgets. bucket is a UTC day ('2026-11-26') or a minute ('m:2026-11-26T17:24');
-- key names the counted thing ('predict:<wallet>', 'other:<wallet>', 'user:<privy id>', 'ip:<hash>', 'budget').
CREATE TABLE usage_daily (
  day       text NOT NULL,
  key       text NOT NULL,
  count     integer NOT NULL DEFAULT 0,
  spent_wei numeric(78, 0) NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);

-- ---------------------------------------------------------------- risk and admin

CREATE TABLE risk_flags (
  id         bigserial PRIMARY KEY,
  wallet     text NOT NULL,
  rule       text NOT NULL,
  score      integer NOT NULL,
  details    jsonb,
  run        text NOT NULL DEFAULT 'hourly' CHECK (run IN ('hourly', 'signup', 'manual')),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked', 'cleared')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX risk_flags_wallet ON risk_flags (wallet, created_at DESC);
CREATE INDEX risk_flags_open ON risk_flags (status) WHERE status = 'open';

CREATE TABLE admin_users (
  privy_user_id text PRIMARY KEY,                         -- 'email:<address>' until the admin's first login binds the real id
  email         text NOT NULL UNIQUE,
  role          text NOT NULL CHECK (role IN ('viewer', 'operator', 'owner')),
  added_by      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,
  action     text NOT NULL,
  target     text,
  payload    jsonb,
  tx_hash    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created ON audit_log (created_at DESC);

-- Admin initiated work the worker performs (operator key) or prepares (owner wallet).
--   kind: resolve_rerun, correct_outcome, compensate, airdrop, image_regenerate, image_fallback, question_replace
CREATE TABLE operator_requests (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,
  target      text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'sent', 'done', 'failed', 'cancelled')),
  result      jsonb,
  tx_hash     text,
  requested_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operator_requests_status ON operator_requests (status, created_at);

-- Small key value store for snapshots the worker refreshes (params, reserves, balances, indexer status) and the API reads.
CREATE TABLE app_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Append only tables: refuse UPDATE and DELETE.
CREATE FUNCTION refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append only', TG_TABLE_NAME;
END $$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION refuse_change();
