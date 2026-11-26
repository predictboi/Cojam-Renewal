-- The choice of a sponsored predict, so GET /v1/today can show a pick accepted by the node before the indexer sees it.
ALTER TABLE sponsored_txs ADD COLUMN choice smallint;
