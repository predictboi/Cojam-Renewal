-- Per player marks the PWA sets (kept off users so the admin player view is unchanged).
-- results_seen_at: when the player last opened Results (GET /v1/me newResults counts answers set after it).
CREATE TABLE user_marks (
  user_id         bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  results_seen_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
