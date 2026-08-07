// Parse an omnibar quick-add line into AddTaskParams. Pure + deterministic:
// pass `now` in tests to pin relative dates. Inline tokens are extracted from
// anywhere in the string (order-independent); whatever text remains after the
// tokens are stripped becomes the task title.
//
//   #project   → project (fuzzy-matched against known projects, else created)
//   @date      → due date  (@today @tmr @fri @3d @2w @2026-08-01)
//   ~est       → estimate  (~30m ~1h ~1h30m ~90) — validated with parseEstMinutes
//   *repeat    → recurrence (*daily *weekly *fortnightly *monthly)

import { type AddTaskParams } from './useTasks';
import {
  formatDayLabelLong,
  kolkataDateString,
  parseEstMinutes,
  shiftKolkataDate,
} from './time';

export type TaskInputPreview = {
  text: string;
  project?: string;
  dueLabel?: string;
  est?: string;
  recurLabel?: string;
};

export type ParsedTaskInput = {
  params: AddTaskParams;
  preview: TaskInputPreview;
  errors: string[];
};

// Token matchers. Each captures the payload after its sigil. `@` also has to
// swallow YYYY-MM-DD (which contains '-'), so its payload class is broad.
const PROJECT_RE = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/u;
const DUE_RE = /(?:^|\s)@([\p{L}\p{N}][\p{L}\p{N}-]*)/u;
const EST_RE = /(?:^|\s)~([\p{L}\p{N}]+)/u;
const RECUR_RE = /(?:^|\s)\*([\p{L}][\p{L}]*)/u;

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const RECUR_MAP: Record<string, string> = {
  daily: 'every day',
  weekly: 'every week',
  fortnightly: 'every 2 weeks',
  biweekly: 'every 2 weeks',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * Resolve an `@date` payload to a YYYY-MM-DD in Asia/Kolkata wall-clock, or
 * null if it isn't a recognised form (caller records an error and leaves the
 * token in the title so nothing is silently dropped).
 */
export function resolveDueToken(raw: string, now: Date): string | null {
  const t = raw.toLowerCase();

  if (t === 'today' || t === 'tod') return kolkataDateString(now);
  if (t === 'tomorrow' || t === 'tmr' || t === 'tom' || t === 'tomo') {
    return shiftKolkataDate(now, 1);
  }

  // Explicit ISO date — accept as-is when well-formed.
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  // Relative offsets: 3d / 2w.
  const rel = /^(\d+)([dw])$/.exec(t);
  if (rel) {
    const n = parseInt(rel[1], 10);
    return shiftKolkataDate(now, rel[2] === 'w' ? n * 7 : n);
  }

  // Weekday name → the NEXT occurrence (strictly future; @mon on a Monday
  // means next Monday, matching how people say "let's do it Monday").
  if (t in WEEKDAYS) {
    const target = WEEKDAYS[t];
    const todayKey = kolkataDateString(now);
    // Read the weekday of the IST calendar date itself: parse it as UTC
    // midnight so getUTCDay() reports that date's day-of-week (constructing it
    // with +05:30 would shift back into the previous UTC day).
    const todayDow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
    let delta = (target - todayDow + 7) % 7;
    if (delta === 0) delta = 7;
    return shiftKolkataDate(now, delta);
  }

  return null;
}

function stripToken(text: string, re: RegExp): string {
  return text.replace(re, ' ');
}

/** Leading letter of each word: "Home & Life" → "hl", "Swiss Relocation 2026" → "sr2". */
function initialsOf(lower: string): string {
  return lower
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
}

/**
 * Are all of `q`'s characters present in `text`, in order (gaps allowed)?
 * Returns the span consumed — from the first matched character to the last — or
 * null when `q` isn't a subsequence at all. A tighter span means a better match:
 * "sos" spans 8 of "sundar os" but only 3 of "sos ops".
 */
function subsequenceSpan(q: string, text: string): number | null {
  let start = -1;
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] !== q[i]) continue;
    if (i === 0) start = j;
    i++;
    if (i === q.length) return j - start + 1;
  }
  return null;
}

/**
 * Score how well a typed `#token` matches a project name. Higher is better;
 * null means no match at all. The tiers are ordered by how deliberate the match
 * looks — an exact name beats a prefix, which beats initials, which beats a
 * substring, which beats a loose subsequence. Within a tier, matches that waste
 * fewer characters rank higher.
 */
function scoreProject(q: string, name: string): number | null {
  const lower = name.toLowerCase();
  if (lower === q) return 1000;
  if (lower.startsWith(q)) return 800 - (lower.length - q.length);

  const initials = initialsOf(lower);
  if (initials === q) return 700;
  if (initials.startsWith(q)) return 650 - (initials.length - q.length);

  const at = lower.indexOf(q);
  if (at !== -1) return 500 - at;

  const span = subsequenceSpan(q, lower);
  if (span !== null) return 300 - (span - q.length);

  return null;
}

/**
 * Best fuzzy match for a typed `#token` among known projects, or null when
 * nothing matches (the caller then treats the token as a new project name).
 *
 * Ties break toward the shorter name — it's the more specific of two otherwise
 * equal candidates — then alphabetically, so the result never depends on the
 * order projects happen to arrive in.
 */
export function matchProject(typed: string, projects: string[]): string | null {
  const q = typed.toLowerCase();
  if (!q) return null;

  let best: string | null = null;
  let bestScore = -Infinity;

  for (const name of projects) {
    const score = scoreProject(q, name);
    if (score === null) continue;
    if (best === null || score > bestScore) {
      best = name;
      bestScore = score;
      continue;
    }
    if (score === bestScore) {
      if (name.length < best.length) best = name;
      else if (name.length === best.length && name < best) best = name;
    }
  }

  return best;
}

export function parseTaskInput(
  raw: string,
  projects: string[] | null,
  now: Date = new Date(),
): ParsedTaskInput {
  const errors: string[] = [];
  const preview: TaskInputPreview = { text: '' };
  const params: AddTaskParams = { text: '' };
  let remaining = raw;

  // ── project ──────────────────────────────────────────────────────────────
  const pm = PROJECT_RE.exec(remaining);
  if (pm) {
    const typed = pm[1];
    // Fuzzy-match an existing project; fall back to the literal typed value
    // (a new project) if nothing matches at all.
    const project = matchProject(typed, projects ?? []) ?? typed;
    params.project = project;
    preview.project = project;
    remaining = stripToken(remaining, PROJECT_RE);
  }

  // ── due ──────────────────────────────────────────────────────────────────
  const dm = DUE_RE.exec(remaining);
  if (dm) {
    const resolved = resolveDueToken(dm[1], now);
    if (resolved) {
      params.due = resolved;
      preview.dueLabel = formatDayLabelLong(
        new Date(`${resolved}T00:00:00+05:30`),
        now,
      );
      remaining = stripToken(remaining, DUE_RE);
    } else {
      errors.push(`Unrecognised date "@${dm[1]}"`);
    }
  }

  // ── estimate ─────────────────────────────────────────────────────────────
  const em = EST_RE.exec(remaining);
  if (em) {
    if (parseEstMinutes(em[1]) !== null) {
      params.est = em[1];
      preview.est = em[1];
      remaining = stripToken(remaining, EST_RE);
    } else {
      errors.push(`Unrecognised estimate "~${em[1]}"`);
    }
  }

  // ── recurrence ───────────────────────────────────────────────────────────
  const rm = RECUR_RE.exec(remaining);
  if (rm) {
    const key = rm[1].toLowerCase();
    if (key === 'monthly') {
      // Anchor the monthly rule to the due day when set, else today's day.
      const anchor = params.due ?? kolkataDateString(now);
      const day = parseInt(anchor.split('-')[2], 10);
      const ord = ordinal(day);
      params.recur = `every month on the ${ord}`;
      preview.recurLabel = `monthly (${ord})`;
      remaining = stripToken(remaining, RECUR_RE);
    } else if (key in RECUR_MAP) {
      params.recur = RECUR_MAP[key];
      preview.recurLabel = key === 'biweekly' ? 'fortnightly' : key;
      remaining = stripToken(remaining, RECUR_RE);
    } else {
      errors.push(`Unrecognised repeat "*${rm[1]}"`);
    }
  }

  // ── title (leftover) ─────────────────────────────────────────────────────
  const text = remaining.replace(/\s+/g, ' ').trim();
  params.text = text;
  preview.text = text;

  return { params, preview, errors };
}
