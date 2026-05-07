# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-user PWA that complements an existing Telegram-based "Sundar OS." Telegram remains the verbose natural-language input layer; this app handles **structured, low-friction taps** — capture flows where typing is the bottleneck. V1 is two flows: **mood log + calendar block, both live**. Out of scope for V1: notifications, history views, editing past entries, multi-user, auth beyond a shared secret.

## Commands

```bash
npm run dev               # local dev server (port 5173)
npm run dev -- --host     # expose on LAN for phone testing during dev
npm run typecheck         # tsc -b --noEmit (project-references typecheck)
npm run test              # vitest run (single shot)
npm run test:watch        # vitest watch mode
npm run build             # tsc -b && vite build (produces dist/ + sw.js + manifest)
npm run preview           # serve dist/ for prod-like local check
npx pwa-assets-generator  # regenerate PNG icons from public/icon.svg
```

Run a single test file: `npx vitest run src/lib/time.test.ts`. Filter by name: `npx vitest run -t 'rolls over'`.

Tests live colocated with source as `*.test.ts`. Pure logic uses Vitest's default `node` env; IndexedDB tests rely on `fake-indexeddb` (auto-imported in `src/test/setup.ts`). No React component tests yet — UI is validated by hand on the phone.

## Stack

- React 18 + Vite 5 + TypeScript (strict, project references via `tsconfig.app.json` + `tsconfig.node.json`)
- Tailwind 3 (no CSS modules; classes only). Dark slate aesthetic, emerald for success/CTA, amber for queued, rose for error/stuck.
- `vite-plugin-pwa` with autoUpdate service worker + Workbox precache. **The SW must never cache `/webhook/*` routes** — see `vite.config.ts` `navigateFallbackDenylist`.
- `idb-keyval` for the offline queue (single key, atomic `update(key, fn)`).
- No router. Page state lives in `App.tsx` once Calendar lands.

## Core architecture: queue-first writes

Every user submission **persists to IndexedDB before any network call**. Pages never call POST functions directly. The flow is always:

1. UI builds payload with `crypto.randomUUID()` as `client_id`.
2. `enqueue(type, payload)` from `src/lib/queue.ts` writes to IDB atomically.
3. UI fires `drainQueue()` from `src/lib/sync.ts` (fire-and-forget). On success within ~2s, UI shows `Logged ✓`; on failure, `Saved — will sync` (entry stays queued).
4. Background drain re-runs on `online` and `visibilitychange` events via `useDrainQueue`, mounted once in `App.tsx`.

This means **the network is never on the critical path of a user tap**. Day 3 abstractions own all retry/error semantics; pages stay declarative.

### Module responsibilities

Layered, dependency flows one way (UI → hooks → lib → idb-keyval/fetch). Lib does not import from `pages/` or `components/`.

| File | Owns | Don't put here |
| --- | --- | --- |
| `lib/queue.ts` | Single-key IDB array (`sundar:queue:v1`), pub/sub for reactive UI, `STUCK_ATTEMPT_THRESHOLD = 5` | Network calls, payload construction |
| `lib/sync.ts` | `drainQueue()` — oldest-first, **stops on first failure**. Dispatch table keyed by `entry.type`. | Anything React |
| `lib/webhookClient.ts` | Generic `postJson(url, payload)` — auth header, JSON body, `WebhookError` mapping. Reads token at call time. | Flow-specific URLs or types |
| `lib/api.ts` | Flow-specific wrappers (`postMood`, `postCalendar`) atop `webhookClient`. URLs from env vars. | Retry/queue logic |
| `lib/time.ts` | Pure time math (`nextQuarterHour`, `snapToQuarterHour`, `addMinutes`, `formatTime`, `formatForGCal`, `formatRelative`). Asia/Kolkata everywhere. | React, side-effects |
| `lib/haptic.ts` | Named haptic patterns (`tap`, `submitStart`, `successRamp`). Single `haptic(name)` API. | Anywhere `navigator.vibrate` is called directly |
| `lib/storage.ts` | Typed `localStorage` wrapper with key constants (`moodLastLoggedAt`, `calendarLastTitle`). | Stringly-typed `localStorage.getItem` calls |
| `lib/useSubmission.ts` | Shared submission state machine (`idle/sending/sent/queued/error`). Owns enqueue+drain+haptics. | Form state |
| `lib/useDrainQueue.ts` | Mount-once hook in `App.tsx`. Drains on mount + `online` + `visibilitychange`. | Per-page logic |
| `lib/usePendingQueue.ts` | Reactive snapshot (`pendingCount`, `stuckCount`) via `subscribe`. | Mutations |
| `components/*` | Presentational only. `PageHeader` is the only one that touches a hook (`usePendingQueue`) — pages shouldn't reach for the badge themselves. | Form state, business logic |
| `pages/*` | Form state + page-specific UX (emoji grid, chips, time row). Compose hooks; never import `queue.ts`/`sync.ts`/`api.ts` directly. | Network calls |
| `routes.ts` | `Page` union type. Single source of truth. When adding a third page, swap to react-router. | Route components |

### Idempotency contract

`client_id` is a UUIDv4 generated **once** when the entry is enqueued. Same id replays on every retry. The backend (`mood_logs` Postgres table) has `client_id UUID UNIQUE`; n8n's `INSERT ... ON CONFLICT (client_id) DO UPDATE ... RETURNING (xmax = 0) AS inserted` returns `inserted: true` for fresh rows and `false` for dedup hits. Obsidian append is gated behind that flag — Postgres is the single source of truth for dedup, Obsidian only mirrors first-inserts.

When adding a new flow: include `client_id` in the payload, ensure the n8n route enforces uniqueness, and trust the queue to handle retries.

## Backend: n8n on the VPS

The frontend never knows backend topology. All flows POST to an n8n webhook with a shared-secret header:

```
X-Auth-Token: $VITE_AUTH_TOKEN  →  matches $MOOD_LOG_AUTH_TOKEN inside n8n
```

`MOOD_LOG_AUTH_TOKEN` is set in `docker-compose.yml` (NOT `.env` — per the existing Sundar OS convention) and reused across flows for V1.

Workflow specs live in `docs/integration.md`:
- **`mood-log` workflow**: Webhook → IF (auth) → Postgres (idempotent INSERT) → IF (`inserted` flag) → Obsidian Code-node append → Respond. The Obsidian code uses `fs.appendFileSync` directly (n8n's Read/Write Files node has a known bug). Vault path is `<root>/500 Journals/Daily/YYYY-MM-DD.md`; mood line format is the inline Dataview field `mood_log:: <rating> | <note>`.
- **`calendar-block` workflow** (Day 4): Webhook → IF (auth) → Google Calendar Create Event → Respond. Reuses GCal credentials already configured in n8n.

CORS: each Webhook node's "Allowed Origins" must include `https://app.srv1536472.hstgr.cloud`. **Reactivate the workflow after any Webhook-node edit** — n8n only re-reads CORS settings on activation.

## Deploy pipeline

Build locally on Mac → `git push` → SSH to VPS → `git pull && npm ci && npm run build`. Nginx (behind Traefik) serves `/opt/sundar-app/dist/` at `https://app.srv1536472.hstgr.cloud/`. **Do not edit code on the VPS**; mirror the Obsidian vault discipline (Mac → Git → VPS pulls).

When debugging "stale on production":
1. `curl -s https://app.srv1536472.hstgr.cloud/ | grep -E 'apple-mobile|index-'` from Mac.
2. Confirm the bundle hash matches the latest `dist/assets/` on the VPS.
3. If the SW is serving stale: Chrome → Site settings → Clear & reset → reopen.

## Time/timezone discipline

This app pretends UTC doesn't exist for display purposes. All user-facing times are **Asia/Kolkata** (no DST, fixed +05:30 offset). Postgres `entry_date` is computed via `(client_timestamp::timestamptz AT TIME ZONE 'Asia/Kolkata')::date` so day boundaries align with the user's actual day even when a request crosses midnight UTC. Day 4's `src/lib/time.ts` will format RFC3339 with `+05:30` literal, not via `Intl.DateTimeFormat`.

## Environment variables (frontend)

`.env.local` (gitignored), seeded from `.env.example`:
```
VITE_WEBHOOK_URL=https://n8n.srv1536472.hstgr.cloud/webhook/mood-log
VITE_WEBHOOK_CALENDAR_URL=https://n8n.srv1536472.hstgr.cloud/webhook/calendar-block
VITE_AUTH_TOKEN=<shared secret matching MOOD_LOG_AUTH_TOKEN on n8n>
```

When adding a new flow: add a `VITE_WEBHOOK_*` env var, update `src/vite-env.d.ts` (`ImportMetaEnv` interface), and `.env.example`. The token is shared across flows for V1.

## Conventions baked into prior sessions

- **Commit and push after each change.** Once typecheck/tests pass for a coherent edit, commit with a focused message and `git push` to `origin/main` immediately — don't batch unrelated changes. The VPS pulls from `main`, so unpushed work is invisible to deploy.
- **No backwards-compat shims.** This is a single-user app with no other consumers; if something needs to change, change it everywhere.
- **No tests, no test framework.** Validate utilities with dev-only console assertions in the module itself.
- **No comments explaining what code does.** Comments only for non-obvious *why* — e.g., `queue.ts` notes that `idb-keyval`'s atomic update prevents enqueue/markDone races; `vite.config.ts` notes the `/webhook` SW denylist exists because cached POSTs would corrupt user data.
- **Tailwind only.** No CSS files beyond `index.css` (which only contains the three `@tailwind` directives plus a body reset).
- **Haptic durations**: 30ms taps, 40ms submit, `[60, 80, 120]` success ramp. iOS Taptic-style sub-20ms is below Android motor perception threshold; do not lower.

## Known VPS gotchas (from prior debugging)

- Vault subdirs need `chown -R 1000:1000 <path>` (n8n container runs as uid 1000) for write access from the Code node.
- `NODE_FUNCTION_ALLOW_BUILTIN=fs,path` must be set in `docker-compose.yml` for the Obsidian Code node's `require('fs')` to work.
- `pg` alias is `docker exec -it postgres psql ...` — the `-t` breaks stdin redirection. Use `pg -c "..."` for one-shot statements or `docker exec -i ...` (no TTY) when piping a `.sql` file.
- Webhook path defaults to a UUID when an n8n Webhook node is created. **Always set the Path field to a friendly slug** (`mood-log`, `calendar-block`) — the frontend hardcodes these.

## How to add a new capture flow

The architecture supports a 4th, 5th, etc. flow with low code overhead. Recipe:

1. **Type**: add to `QueuedEntry['type']` union in `lib/queue.ts`.
2. **Payload type**: define in `lib/api.ts` (must extend `{ client_id: string }`).
3. **Client**: add `postX(payload)` in `lib/api.ts` calling `postJson`.
4. **Dispatch**: add `x: (p) => postX(p as ...)` to the `dispatchers` table in `lib/sync.ts`.
5. **Page**: new file in `pages/`, uses `useSubmission<XPayload>('x')` + `<PageHeader>` + `<SubmitButton>` + `<StatusLine>`.
6. **Route**: add to `Page` union in `routes.ts`, render in `App.tsx`, add tab in `components/TabBar.tsx`.
7. **n8n**: new workflow following the pattern in `docs/integration.md` (Webhook → IF auth → \[handler\] → Respond). Reuse `MOOD_LOG_AUTH_TOKEN`.
8. **Env**: `VITE_WEBHOOK_X_URL` in `.env.example` + `vite-env.d.ts`.
9. **Tests**: extend `sync.test.ts` to include the new dispatcher and integration test.

If any of these steps gets gnarly, the abstraction needs fixing — don't paper over it.

## See also

- `docs/integration.md` — full n8n + Postgres + Obsidian + Google Calendar wiring (workflow node-by-node, DDL, test plan)
- `docs/migration-day3.sql` — the `client_id UUID UNIQUE` migration
- `pwa-assets.config.ts` — icon generation source; rerun `npx pwa-assets-generator` after editing `public/icon.svg`
