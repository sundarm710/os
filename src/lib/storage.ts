// Typed localStorage wrapper. All keys live here so we can audit usage and
// avoid stringly-typed key collisions across files.

const KEYS = {
  journalLastLoggedAt: 'journal:lastLoggedAt',
  calendarLastTitle: 'calendar:lastTitle',
  learnLastTopicSlug: 'learn:lastTopicSlug',
} as const;

export type StorageKey = keyof typeof KEYS;

export function readString(key: StorageKey): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEYS[key]);
}

export function writeString(key: StorageKey, value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEYS[key], value);
}

export function clearKey(key: StorageKey): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEYS[key]);
}

// Session-scoped handoff between Tasks → Calendar. Cleared once Calendar
// hydrates from it. Kept in sessionStorage (not local) so a stale prefill
// can't leak across browser sessions if the user closes the tab mid-flow.
const PREFILL_KEY = 'calendar:prefill';

export type CalendarPrefill = {
  taskId: string | null;
  title: string;
  date: string;        // YYYY-MM-DD in Asia/Kolkata
  durationMin: number;
  // Optional: if absent, Calendar uses its own nextFreeStart() logic.
  startTime?: string;  // HH:MM (24h) wall-clock IST
};

export function writeCalendarPrefill(p: CalendarPrefill): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p));
}

export function readCalendarPrefill(): CalendarPrefill | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CalendarPrefill;
  } catch {
    return null;
  }
}

export function clearCalendarPrefill(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(PREFILL_KEY);
}
