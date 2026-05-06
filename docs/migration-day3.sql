-- Day 3, Phase 2 migration: client_id idempotency key for mood_logs.
--
-- Apply on the VPS via:
--   pg < docs/migration-day3.sql
-- or paste into psql.

BEGIN;

ALTER TABLE mood_logs
  ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;

CREATE INDEX IF NOT EXISTS mood_logs_client_id_idx
  ON mood_logs (client_id);

COMMIT;

-- Sanity check — confirm the column + constraint + index exist.
\d mood_logs
