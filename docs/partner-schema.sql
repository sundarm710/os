-- Shared partner feature: tasks + configurable end-of-day checklist.
--
-- Apply on the VPS via:
--   pg < docs/partner-schema.sql
-- or paste into psql.

BEGIN;

-- Shared partner tasks — deliberately separate from pm_headless.py's vault
-- tasks (concurrent multi-writer risk there; no assignee field).
CREATE TABLE IF NOT EXISTS partner_tasks (
  id            BIGSERIAL   PRIMARY KEY,
  client_id     UUID        UNIQUE,
  text          TEXT        NOT NULL,
  assignee      TEXT        CHECK (assignee IN ('sundar','partner')),  -- NULL = either/shared
  created_by    TEXT        NOT NULL CHECK (created_by IN ('sundar','partner')),
  status        TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  completed_by  TEXT        CHECK (completed_by IN ('sundar','partner')),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_tasks_status_idx ON partner_tasks (status, created_at DESC);

-- Configurable checklist item *definitions*. Editable via inline admin UI,
-- no deploy required. item_type drives client rendering (toggle pill vs
-- textarea); audience documents intent only (both people can always see
-- both people's answers — see partner_checklist_responses).
CREATE TABLE IF NOT EXISTS partner_checklist_items (
  id          BIGSERIAL   PRIMARY KEY,
  item_key    TEXT        NOT NULL UNIQUE,
  label       TEXT        NOT NULL,
  item_type   TEXT        NOT NULL CHECK (item_type IN ('boolean','text')),
  audience    TEXT        NOT NULL DEFAULT 'self' CHECK (audience IN ('self','partner_note')),
  sort_order  INT         NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,   -- soft delete: preserves history
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_checklist_items_active_idx
  ON partner_checklist_items (active, sort_order);

-- One row per (item, person, day). Natural key is the upsert target — a
-- resubmit same-day overwrites, it does not append a new row.
CREATE TABLE IF NOT EXISTS partner_checklist_responses (
  id          BIGSERIAL   PRIMARY KEY,
  item_id     BIGINT      NOT NULL REFERENCES partner_checklist_items(id) ON DELETE CASCADE,
  person      TEXT        NOT NULL CHECK (person IN ('sundar','partner')),
  entry_date  DATE        NOT NULL,
  value_bool  BOOLEAN,
  value_text  TEXT,
  client_id   UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, person, entry_date)
);
CREATE INDEX IF NOT EXISTS partner_checklist_responses_day_idx
  ON partner_checklist_responses (entry_date DESC);

-- Starter checklist items.
INSERT INTO partner_checklist_items (item_key, label, item_type, audience, sort_order) VALUES
  ('soaked_millets', 'Soaked millets?', 'boolean', 'self', 1),
  ('put_trash_out', 'Put the trash out?', 'boolean', 'self', 2),
  ('pending_conversations_tomorrow', 'Pending conversations for tomorrow?', 'text', 'partner_note', 3),
  ('plans_partner_should_know', 'Plans tomorrow the other person should know about?', 'text', 'partner_note', 4),
  ('mindful_about_me_today', 'Anything to be mindful of about me today?', 'text', 'partner_note', 5)
ON CONFLICT (item_key) DO NOTHING;

COMMIT;

-- Sanity check.
\d partner_tasks
\d partner_checklist_items
\d partner_checklist_responses
