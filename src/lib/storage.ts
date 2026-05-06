// Typed localStorage wrapper. All keys live here so we can audit usage and
// avoid stringly-typed key collisions across files.

const KEYS = {
  moodLastLoggedAt: 'mood:lastLoggedAt',
  calendarLastTitle: 'calendar:lastTitle',
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
