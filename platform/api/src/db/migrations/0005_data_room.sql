-- Data room: an outside market linked to a question (DECISIONS "Data room: outside comparison").
-- At most one link per question; most questions have none. The worker job `outside-prices` reads the price of the
-- outside outcome that matches our right choice (choice B: yes, up, over) once, right after our day closes.
-- A failed read leaves right_price empty (error says why) and blocks nothing.
CREATE TABLE market_outside (
  market_id      bigint PRIMARY KEY REFERENCES markets (market_id) ON DELETE CASCADE,
  source         text NOT NULL CHECK (source IN ('polymarket')),
  url            text NOT NULL,
  -- Polymarket market slug: GET https://gamma-api.polymarket.com/markets/slug/{slug}
  market_slug    text NOT NULL,
  -- The outside outcome label that corresponds to our right choice (for example "Yes", or "No" for a question asked the other way round).
  right_outcome  text NOT NULL,
  right_price    smallint CHECK (right_price BETWEEN 0 AND 100),
  taken_at       timestamptz,
  attempted_at   timestamptz,
  error          text,
  linked_by      text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_outside_unread ON market_outside (market_id) WHERE attempted_at IS NULL;
