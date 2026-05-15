# os

A personal operating system I'm building for myself, focused on accountability — checking whether the day I actually lived matched the life I said I was working toward.

This repo is the PWA frontend. The backend (n8n workflows, Postgres, a markdown vault) runs privately on a small VPS.

---

## What it tracks

A few things I care about, all in one place:

| Domain | What gets captured |
|---|---|
| Strength | Sets, reps, weight, how it felt, the split (push/pull/legs/etc.) |
| Cardio | Duration, distance, HR zone |
| Nutrition | Meals, protein, calories |
| Weight | Daily weigh-in, body comp trend |
| Money | Net worth log, expenditure, ROI, allocation |
| Tasks | Open / in-progress / done, with due dates |
| Journaling | Thought logs, work logs, reading logs |
| Calendar | Time-blocked days with themed categories |
| Relationships | Briefs and touch-point reminders for the people who matter |

Each capture is one tap from the app or one short message over Telegram.

---

## How it's wired

```
                         +--------------------------+
                         |   Telegram (primary)     |
                         |   PWA  (mobile, offline) |
                         |   Cron / Calendar (auto) |
                         +------------+-------------+
                                      |
                              one short message
                                      |
                                      v
                         +--------------------------+
                         |  Router (n8n workflow)   |
                         |  classifies via Claude   |
                         +------------+-------------+
                                      |
              +-----------+-----------+-----------+-----------+
              v           v           v           v           v
           Strength   Nutrition    Tasks       Journal     Money
            log         log       (add/done)  (mood/log)  dashboard
              |           |           |           |           |
              +-----------+-----------+-----------+-----------+
                                      |
                       +--------------+---------------+
                       v              v               v
                  Postgres       Markdown vault   Daily note
                  (queries)      (PARA, git)      (timeline)
```

Three places things land, by design:

- **Postgres** for the queryable stuff — *last leg workout*, *net worth trend*, *protein this week*.
- **Markdown vault** (git-versioned) for permanence — plain text I can still read in twenty years without any runtime.
- **Daily note** for narrative — a single timeline of what actually happened today, stitched from everything else.

---

## This repo: the PWA

A React + Vite + Tailwind PWA. Installs to the home screen, works offline, syncs when reachable. It's deliberately small — the data lives elsewhere; this is just the window into it.

### Tabs

- **Today** — daily brief, mood capture, thought log.
- **Tasks** — open / today / overdue, long-press to start, tap to complete.
- **Calendar** — time-blocking with categorized themes.
- **Workouts** — strength and cardio history, filterable by split, with a copy-to-log helper for repeating sessions.

### A few principles I tried to stick to

- Capture should take one tap. If logging a workout takes a minute, I'll skip it.
- The app is a view, not the source of truth. The database and vault are. The app can be rebuilt; the data shouldn't ever be at risk.
- Offline-first. A flaky tunnel shouldn't be an excuse to break the habit.
- Self-hosted where possible. Less surface area, less vendor risk.
- Boring tech. The interesting part is showing up, not the framework.

### Stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite + Tailwind |
| State | Local component state + idb-keyval for the offline queue |
| Transport | `fetch` to n8n webhooks with a shared token |
| Hosting | Static build, nginx on a VPS, Cloudflare DNS |
| PWA | `vite-plugin-pwa` + Workbox |
| Tests | Vitest + fake-indexeddb |

---

## Running it locally

```bash
git clone git@github.com:sundarm710/os.git
cd os
npm install
cp .env.example .env.local   # fill in webhook URLs + auth token
npm run dev
```

Deploy on the VPS is just `git pull && npm run build` — nginx serves `dist/` directly.

The backend isn't in this repo. The webhook contracts the PWA depends on are documented under `docs/`.

---

## Status

In daily use since early 2026. Still very much a moving target — I add or rework whatever I'm currently using and notice I want.

This is a personal system shared openly. It's not a product or a template to adopt as-is, but if any of the architecture or ideas are useful for your own version, please take them.

---

## License

MIT.
