# Day 1 — n8n + Postgres + Obsidian integration

Everything below is what the PWA expects on the backend. Configure once in n8n, then the app just hits the webhook.

## Webhook contract

- **Test URL**: `https://n8n.srv1536472.hstgr.cloud/webhook-test/mood-log`
- **Prod URL**: `https://n8n.srv1536472.hstgr.cloud/webhook/mood-log` (after activating workflow)
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Auth-Token: <shared-secret>` — must match n8n env var `MOOD_LOG_TOKEN`
- **Body**:
  ```json
  {
    "rating": 4,
    "note": "good morning run",
    "client_timestamp": "2026-05-03T17:20:00.000Z"
  }
  ```
  `note` may be `null`. `rating` is `1..5`.

## n8n workflow — `mood-log`

Three nodes after the Webhook trigger.

### 1. Webhook node

| Field | Value |
| --- | --- |
| HTTP Method | `POST` |
| Path | `mood-log` |
| Response Mode | `Last Node` |
| Response Code | `200` |

### 2. IF node — auth check

Single condition (string equals):

```
{{$json["headers"]["x-auth-token"]}} == {{$env.MOOD_LOG_AUTH_TOKEN}}
```

- TRUE branch → continue.
- FALSE branch → `Respond to Webhook` node returning `401`.

Set `MOOD_LOG_AUTH_TOKEN` in `docker-compose.yml` (NOT `.env` — per existing convention) and restart n8n.

### 3a. Postgres node — insert

| Field | Value |
| --- | --- |
| Operation | `Execute Query` |
| Query | see below |

```sql
INSERT INTO mood_logs (entry_date, rating, note)
VALUES (
  ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,
  $2,
  NULLIF($3, '')
);
```

Query parameters (in order):
1. `={{$json["body"]["client_timestamp"]}}`
2. `={{$json["body"]["rating"]}}`
3. `={{$json["body"]["note"] || ""}}`

Timezone cast keeps `entry_date` aligned with the user's local day even when the request crosses midnight UTC.

### 3b. Code node — append to Obsidian daily note

Runs in parallel with 3a (both downstream of the IF/TRUE branch).

`NODE_FUNCTION_ALLOW_BUILTIN=fs,path` must already be set on the n8n container — it is, per existing flows.

```javascript
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = '/data/vault'; // align with existing n8n flows

const body = $input.first().json.body;
const ts = new Date(body.client_timestamp);

// Local date in Asia/Kolkata for filename
const local = new Date(ts.getTime() + 5.5 * 60 * 60 * 1000);
const yyyy = local.getUTCFullYear();
const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
const dd = String(local.getUTCDate()).padStart(2, '0');
const dateStr = `${yyyy}-${mm}-${dd}`;

const filePath = path.join(VAULT_ROOT, '500 Journals', 'Daily', `${dateStr}.md`);

if (!fs.existsSync(filePath)) {
  const frontmatter = `---\ndate: ${dateStr}\n---\n\n`;
  fs.writeFileSync(filePath, frontmatter, 'utf8');
}

const rating = body.rating;
const note = (body.note || '').trim();
const line = note
  ? `mood_log:: ${rating} | ${note}\n`
  : `mood_log:: ${rating}\n`;

fs.appendFileSync(filePath, line, 'utf8');

return [{ json: { ok: true, path: filePath } }];
```

Confirm `VAULT_ROOT` matches the bind mount inside the n8n container used by other flows. If the bind is read-only or owned by root, run `chown -R 1000:1000 <path>` on the host (n8n runs as uid 1000).

### 4. Respond to Webhook (TRUE branch terminus)

Status `200`, body `{"ok": true}`.

## Postgres DDL — run once on the VPS

```sql
CREATE TABLE IF NOT EXISTS mood_logs (
  id          SERIAL PRIMARY KEY,
  entry_date  DATE        NOT NULL,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mood_logs_entry_date_desc_idx
  ON mood_logs (entry_date DESC);
```

Apply via `pg` alias: `pg -c "$(cat <<'SQL' ... SQL)"` or paste into psql.

## Test plan

1. Activate the n8n workflow (test webhook URL goes live for 60s on each test, or activate for prod URL).
2. From local Mac: `curl -X POST -H 'Content-Type: application/json' -H 'X-Auth-Token: <secret>' -d '{"rating":4,"note":"smoke test","client_timestamp":"2026-05-03T12:00:00Z"}' <webhook-url>`
3. Verify: `pg -c "SELECT * FROM mood_logs ORDER BY id DESC LIMIT 1;"`
4. Verify: `cat "<vault>/500 Journals/Daily/2026-05-03.md"` ends with `mood_log:: 4 | smoke test`.
5. From the PWA on phone: tap an emoji. Same row + line should appear.

## Failure modes to watch

- `401` from auth IF → token mismatch between `.env.local` and `MOOD_LOG_AUTH_TOKEN` in n8n.
- Postgres FK or constraint error → confirm table exists and `rating` is in 1..5.
- File write `EACCES` → vault subdir ownership; `chown -R 1000:1000`.
- File written but invisible in Obsidian → vault Git auto-pull cron interval; manual `git pull` in vault.
