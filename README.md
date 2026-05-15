# Sundar OS

> A personal operating system for accountability.
> Not productivity. Not optimization. Accountability — to a life I said I wanted.

![status: in active use](https://img.shields.io/badge/status-in_active_use-brightgreen)
![stack: n8n + Postgres + React PWA](https://img.shields.io/badge/stack-n8n_+_Postgres_+_React_PWA-blue)
![interface: Telegram + PWA](https://img.shields.io/badge/interface-Telegram_%2B_PWA-purple)
![license: MIT](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Why this exists

Most tools optimize for *more output*. Sundar OS optimizes for the opposite question:

**Did the day you lived match the life you said you were building?**

I was tired of:

- Habit trackers that decay into checkboxes I tick on autopilot.
- Productivity apps that confuse busyness with direction.
- Journals that turn into a graveyard of forgotten intentions.
- Spreadsheets I update for a week and abandon.

So I built a system that watches me, gently, across every dimension I care about — strength, money, energy, mood, work, reading, relationships — and surfaces the gap between intent and behavior. Every day. With receipts.

This repo is the **frontend** to that system: a mobile-first PWA I use to capture, query, and reflect from anywhere. The backend (n8n workflows, Postgres, scripts, prompts) lives privately and runs on my own VPS.

---

## What it does

A single, opinionated surface for nine domains:

| Domain | What gets captured | Why |
|---|---|---|
| **Strength** | Every set, rep, weight, feel, split (push/pull/legs) | Strength is the only honest progress signal I trust |
| **Cardio** | Duration, distance, HR zone, perceived effort | Zone-2 minutes are the leading indicator of energy weeks out |
| **Nutrition** | Meals, protein, calories | Lagging signals only — no calorie obsession, just truth |
| **Weight & body** | Daily weigh-in, body comp | Trend, not point |
| **Money** | Net worth log, expenditure, ROI, allocation | The Dashboard view is the only place I look for "am I OK?" |
| **Tasks** | Open, in-progress, done, blocked | Plain text, file-backed, no SaaS lock-in |
| **Journaling** | Thought logs with mood, work logs, reading logs | Append-only. The shape of a week is in the timestamps |
| **Calendar** | Time-blocking with categorized themes | "Where did the week go?" answered before it goes |
| **Relationships** | Briefs for partner, family touch-points | The thing tools never help with, but matters most |

Each capture is one tap or one Telegram message. The system writes to a real database, a versioned vault, and a daily note — all three, all the time.

---

## The shape of the system

```
                          +--------------------------+
                          |   Telegram (primary)     |
                          |   PWA  (mobile, offline) |
                          |   Cron / Calendar (auto) |
                          +------------+-------------+
                                       |
                              one intent per message
                                       |
                                       v
                          +--------------------------+
                          |   SO-Router (n8n)        |
                          |   classifies via Claude  |
                          +------------+-------------+
                                       |
              +------------+-----------+------------+------------+
              v            v           v            v            v
          Strength     Nutrition     Tasks       Journal       Money
            Log          Log       (add/done)  (mood/log)    Dashboard
              |            |           |            |            |
              +------------+-----------+------------+------------+
                                       |
                       +---------------+----------------+
                       v               v                v
                  Postgres       Obsidian Vault     Daily Note
                  (analytics)    (PARA, git)        (markdown)
```

Three substrates, on purpose:

- **Postgres** for queries — *last leg workout*, *net worth trend*, *protein this week*.
- **Vault (markdown, git)** for permanence — text I can read in twenty years without a runtime.
- **Daily note** for narrative — the unified timeline of what actually happened today.

---

## This repo: the PWA

A React + Vite + Tailwind PWA that I use as the everyday surface. Installs to the home screen, works offline, syncs when reachable.

### Tabs

- **Today** — daily brief, mood capture, thought log.
- **Tasks** — open / today / overdue, long-press to start, tap to complete.
- **Calendar** — time-blocking, color-coded categories, "next free slot" helpers.
- **Workouts** — strength + cardio history, filterable by split (push/pull/legs/upper/lower/full/home/mobility), with copy-to-log for variant sessions.

### Design principles

1. **One-tap capture, zero-thought review.** If logging a workout takes more than a minute, I won't.
2. **The PWA is a view, not the source of truth.** Database and vault are. The app can be rebuilt; the data is sacred.
3. **Offline-first, queue-on-failure.** A flaky train tunnel can't be an excuse to skip.
4. **No third-party SaaS in the hot path.** Self-hosted, on my VPS, behind my domain.
5. **Boring tech, boring UI.** The discipline is in showing up, not in the framework.

### Stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite + Tailwind |
| State | Local component state + idb-keyval for offline queue |
| Transport | `fetch` to n8n webhooks with shared token auth |
| Hosting | Static build, nginx on VPS, Cloudflare DNS |
| PWA | `vite-plugin-pwa` + Workbox precache |
| Tests | Vitest + fake-indexeddb |

---

## Running it

```bash
git clone git@github.com:sundarm710/os.git sundar-app
cd sundar-app
npm install
cp .env.example .env.local   # fill in webhook URLs + auth token
npm run dev
```

Deploy on the VPS is `git pull && npm run build` — nginx serves `dist/` directly.

The backend (n8n workflows, Postgres schema, prompts) is intentionally not in this repo. The webhook contracts the PWA depends on are documented in `docs/`.

---

## What I'd tell my past self

- The point isn't to track everything. It's to track the *few* things you said matter, *consistently enough* that they can't be ignored.
- Build the capture friction down to one tap before you build any reporting. You'll never report on data you didn't capture.
- The most valuable view is the one that answers *did you actually live this week the way you said you would?*. Build that one first.
- Self-hosting is a feature, not a chore. Your data outlives any vendor's roadmap.

---

## Status

In daily use since early 2026. Active development — what you see is what I rely on.

This is a personal system shared openly. It is **not** a product, **not** a framework, **not** a template to adopt as-is. The architecture is reusable; the choices are mine. Take what's useful, fork what isn't.

---

## License

MIT. Use it, fork it, learn from it. No warranty, no support, no resale as SaaS without attribution.
