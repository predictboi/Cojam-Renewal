-- Worker additions (owned by the worker; the base schema is 0001_init.sql). Forward only.

-- One row per operator transaction the worker builds, signs and sends (audit and crash recovery).
-- status: simulating -> sim_reverted | signed -> sent -> mined | reverted | dropped | failed
CREATE TABLE worker_operator_txs (
  id            bigserial PRIMARY KEY,
  job           text NOT NULL,                           -- the job that asked for it (registration, publish, settle, ...)
  target        text NOT NULL,                           -- contract address
  method        text NOT NULL,                           -- function name
  args          jsonb NOT NULL,                          -- decoded arguments (bigints as strings)
  calldata      text NOT NULL,
  nonce         bigint,
  tx_type       text,                                    -- legacy | eip1559
  gas_limit     numeric(78, 0),
  gas_price     numeric(78, 0),                          -- legacy gas price or max fee per gas
  tx_hash       text,
  raw_tx        text,                                    -- signed bytes, kept until final so a restart can rebroadcast
  replaced_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,    -- earlier hashes of the same nonce (gas price bumps)
  status        text NOT NULL DEFAULT 'simulating'
                CHECK (status IN ('simulating', 'sim_reverted', 'signed', 'sent', 'mined', 'reverted', 'dropped', 'failed')),
  error         text,
  error_name    text,                                    -- decoded custom error (NotReadyToSettle, BadWinners, ...)
  gas_used      numeric(78, 0),
  fee_wei       numeric(78, 0),
  block         bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worker_operator_txs_open ON worker_operator_txs (status) WHERE status IN ('signed', 'sent');
CREATE INDEX worker_operator_txs_created ON worker_operator_txs (created_at DESC);
CREATE INDEX worker_operator_txs_hash ON worker_operator_txs (tx_hash);

-- Alerts written by the monitors and the jobs; delivered through the alert sink (Telegram, email).
-- key de-duplicates a standing condition: while an alert with the same key is open, it is counted, not repeated.
CREATE TABLE worker_alerts (
  id           bigserial PRIMARY KEY,
  key          text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  title        text NOT NULL,
  body         text,
  details      jsonb,
  count        integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  resolved_at  timestamptz
);
CREATE UNIQUE INDEX worker_alerts_open_key ON worker_alerts (key) WHERE resolved_at IS NULL;
CREATE INDEX worker_alerts_created ON worker_alerts (created_at DESC);

-- Compensated(marketId, user, points) from the index: who was already compensated for a corrected market.
CREATE TABLE worker_compensations (
  market_id bigint NOT NULL,
  wallet    text NOT NULL,
  points    bigint NOT NULL,
  tx_hash   text NOT NULL,
  log_index integer NOT NULL,
  PRIMARY KEY (market_id, wallet)
);

-- Draft facts the selection and the code checks need later (observation time for duplicates and timing).
ALTER TABLE markets ADD COLUMN IF NOT EXISTS observes_at timestamptz;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS kind text;

-- Keyed hash of the email local part shape (letters, digits replaced by #), written by the API at sign up,
-- read by the look alike rule of the risk check. HMAC(EMAIL_HASH_KEY, domain + ':' + shape).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_shape_hash text;
CREATE INDEX IF NOT EXISTS users_email_shape ON users (email_shape_hash) WHERE email_shape_hash IS NOT NULL;
