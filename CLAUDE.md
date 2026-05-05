# Sundar OS Companion App

PWA companion to the existing Telegram-based Sundar OS. Telegram stays as the verbose, natural-language input layer. This app handles structured, low-friction taps — capture flows where typing is the bottleneck.

This is also a product-thinking exercise. Scope discipline matters more than feature count.

## V1 scope (locked)

Two capture flows. Nothing else.

1. **Mood log** — daily, ~3s capture, 1-tap rating + optional 1-line note
2. **Calendar block** — Google Calendar event in ≤10s, smart defaults

**Out of scope for v1:** notifications, history views/charts/dashboards, editing past entries, multi-user, auth beyond shared secret.

## Stack (locked)

- Frontend: React + Vite + TypeScript + Tailwind
- PWA: `vite-plugin-pwa`
- Backend: existing n8n on VPS, new webhook endpoints
- Storage: existing Postgres (new `mood_logs` table) + existing Obsidian vault (daily note append)
- Calendar: Google Calendar API via n8n
- Hosting: VPS subdomain `app.srv1536472.hstgr.cloud`, Nginx behind Traefik
- Auth: shared secret in `X-Auth-Token` header, stored in localStorage. First visit via magic-link URL with token, bookmark once.

## Architecture

```
Phone (PWA, home-screen install)
  ↓ POST + X-Auth-Token
Traefik → Nginx (static at app.srv1536472.hstgr.cloud)
  ↓ fetch() to n8n webhook
n8n webhook → branch on payload type
  ├─ mood: INSERT into Postgres mood_logs + append to Obsidian daily note
  └─ calendar: Google Calendar API create_event via n8n GCal node
```

## Repo layout

```
src/
├── App.tsx              # router (mood / calendar)
├── pages/
│   ├── Mood.tsx
│   └── Calendar.tsx     # Day 4
├── lib/
│   ├── api.ts           # webhook POST + offline queue (queue: Day 3)
│   └── time.ts          # snap-to-15-min helpers (Day 4)
├── main.tsx
└── index.css
public/
├── manifest.json        # Day 2
└── icons/               # Day 2
```

## Feature specs

### Mood log
- 5-emoji grid (😞😕😐🙂😄) → ratings 1–5
- Optional single-line note
- One tap on emoji submits; optional note adds a second tap
- Target: <3s from launch to logged
- Cadence: ad-hoc (scheduled prompts = v2 notifications)
- Postgres `mood_logs(id, entry_date, rating, note, created_at)`
- Obsidian: append `mood_log:: <rating> | <note>` to daily note

### Calendar block (Day 4)
- Title dropdown: `Build`, `Chill`, `Amrutha`, `Chores`, `Admin`
- Smart defaults: start = next :00/:15/:30/:45; duration = 60 min; title = most-recent
- Tap to change defaults; don't require fresh selection each time
- 15-min minimum block, 15-min snap
- Target: <10s from launch to event created
- Storage: GCal primary calendar via n8n

## Build order — do not deviate

1. **Day 1**: Mood flow end-to-end. Vite + React + TS + Tailwind scaffolded, one screen, hits n8n webhook, lands in Postgres + Obsidian. Test from phone via local Wi-Fi (`npm run dev -- --host`).
2. **Day 2**: Production build. Deploy to VPS subdomain via Nginx + Traefik. PWA install, standalone launch.
3. **Day 3**: Offline queue with IndexedDB (Dexie or idb-keyval). Replay on reconnect. Test in airplane mode.
4. **Day 4**: Calendar flow. GCal via n8n. Reuse mood-flow shell.
5. **STOP.** Use it for 2 weeks before any v2 work.

## Confirmed integration details

1. **n8n GCal credentials**: already configured. Reuse on Day 4.
2. **Obsidian daily note path**: `500 Journals/Daily/YYYY-MM-DD.md`. Vault root on VPS = same as existing n8n flows.
3. **Mood entry format in Obsidian**: inline Dataview field `mood_log::` (consistent with `thought_log::`):
   ```
   mood_log:: <rating> | <note if present>
   ```
   Integer 1–5. Omit ` | <note>` if no note. Append; create file with minimal frontmatter if missing (mirror existing journal-creation logic).
4. **TypeScript**: `strict: true`. `.tsx` for components, `.ts` for lib.
5. **Node**: ≥18 for Vite 5; 20 LTS recommended. (Local dev confirmed on v22.)

## Existing Sundar OS infra (context)

Hostinger KVM1 VPS, all running:
- n8n in Docker, custom `n8n-fixed:local`, env vars in `docker-compose.yml` (NOT `.env`)
- Postgres with `pg` alias in `~/.bashrc`, parameterized queries
- Traefik for reverse proxy + SSL
- Nginx serves the existing podcast subdomain — same pattern reused for app subdomain
- Obsidian vault synced via Git (`sundarm710/ThoughtDen`), auto-commit/push every 10 min from both Mac and VPS cron
- Telegram bot is the existing OS interface
- Claude Sonnet API for intent classification, coaching, parsing
- OpenAI TTS for podcast generation

## Known VPS gotchas (from prior debugging)

- Vault subdirs need `chown -R 1000:1000` (n8n runs as uid 1000) for write
- `NODE_FUNCTION_ALLOW_BUILTIN=fs,path` required in `docker-compose.yml` for n8n Code-node fs access
- Read/Write Files n8n node has a bug — use Code node with `fs.writeFileSync`/`fs.appendFileSync` instead
- Foreign keys: delete child rows before parent (e.g., `strength_sets` before `sessions`)
- Claude API responses: use delimiter-based parsing (`JSON_START/JSON_END`) instead of raw `JSON.parse()` — apostrophes break it

## User preferences

- Direct, concise — no softening, no excessive caveats
- Structured output — tables, clear sections, honest trade-offs
- Incremental builds — validate each step before wiring the next
- File-based, no vendor lock-in — plain markdown/YAML/code in Git
- n8n first for orchestration before custom code
- Single-user, private over shared/cloud

## Development workflow

Build locally on Mac. Git is source of truth. VPS is deploy target only.

- Local (Mac): this repo. `npm run dev -- --host` for live reload. Phone tests on local Wi-Fi via Mac's IP during dev.
- GitHub: `sundar-app` repo (new), pushed from Mac.
- VPS: `/opt/sundar-app/` — clones from GitHub, runs `npm ci && npm run build`, Nginx serves `dist/`. No editing on VPS.

Mirrors the Obsidian vault pattern (edit on Mac → Git → VPS pulls). Do NOT scaffold inside the VPS.

## Day 1 deliverables (this commit)

- [x] CLAUDE.md
- [ ] Vite + React + TS + Tailwind scaffold
- [ ] `vite-plugin-pwa` installed (config = Day 2)
- [ ] Mood page: 5-emoji grid + optional note + submit
- [ ] `lib/api.ts`: webhook POST (offline queue = Day 3)
- [ ] `docs/integration.md`: n8n webhook config, Postgres DDL, Obsidian Code-node snippet

Do NOT scaffold Calendar, offline queue, PWA install config, or deploy infra in Day 1.

## Env vars (local dev)

`.env.local` (gitignored):
```
VITE_WEBHOOK_URL=https://n8n.srv1536472.hstgr.cloud/webhook-test/mood-log
VITE_AUTH_TOKEN=<shared-secret>
```

Production swap: `webhook-test` → `webhook` once n8n flow is activated.
