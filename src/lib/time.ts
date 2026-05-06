// Pure time math. Asia/Kolkata everywhere — fixed +05:30 offset, no DST.
//
// All inputs are Date objects (which represent absolute UTC instants); these
// helpers reason about wall-clock minutes/quarters and the IST offset only at
// formatting boundaries.

export const KOLKATA_OFFSET_MINUTES = 5 * 60 + 30; // +05:30

const QUARTER_MIN = 15;

/** Add minutes to a Date, returning a new Date. */
export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/**
 * Round a Date backward to the most recent :00, :15, :30, or :45 boundary in
 * the local wall-clock (inclusive — if `now` is exactly on a boundary, returns
 * `now` with seconds/ms zeroed).
 *
 * Use cases: "snap Start back to the most-recent quarter hour from now" so a
 * user who has dragged into the future can return with one tap.
 */
export function previousQuarterHour(now: Date): Date {
  const out = new Date(now);
  out.setSeconds(0, 0);
  const minutes = out.getMinutes();
  out.setMinutes(minutes - (minutes % QUARTER_MIN));
  return out;
}

/**
 * Round a Date forward to the next :00, :15, :30, or :45 boundary in the
 * local wall-clock. If `now` is exactly on a boundary, returns the next one
 * (always strictly forward).
 *
 * Edge cases handled:
 *  - 11:53 PM → midnight tomorrow
 *  - sub-second precision (11:14:00.500 → 11:15)
 *  - 12:00:00.000 exactly → 12:15
 */
export function nextQuarterHour(now: Date): Date {
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  const remainder = minutes % QUARTER_MIN;
  const isOnBoundary = remainder === 0 && seconds === 0 && ms === 0;
  const minutesToAdd = isOnBoundary ? QUARTER_MIN : QUARTER_MIN - remainder;

  const out = new Date(now);
  out.setMinutes(minutes + minutesToAdd, 0, 0);
  return out;
}

/**
 * Round a Date to the nearest :15 boundary (forward or backward, whichever is
 * closer). On exact halfway (7.5 min), rounds forward.
 */
export function snapToQuarterHour(d: Date): Date {
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ms = d.getMilliseconds();
  const totalSubMinute = seconds / 60 + ms / 60_000;
  const fractional = (minutes % QUARTER_MIN) + totalSubMinute;
  const rounded = Math.round(fractional / QUARTER_MIN) * QUARTER_MIN;
  const delta = rounded - (minutes % QUARTER_MIN) - totalSubMinute;

  const out = new Date(d.getTime() + delta * 60_000);
  out.setSeconds(0, 0);
  return out;
}

/**
 * Format for display in the user's wall-clock (e.g. "2:45 PM"). Uses Intl
 * with explicit en-US locale so output is stable across browsers.
 */
export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format with month + day + time (e.g. "May 7 · 2:45 PM"). Used for the
 * Calendar summary footer where the user needs the date so day-rollover is
 * visible (drag past midnight, drag back to yesterday, etc.).
 */
export function formatDateTime(d: Date): string {
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
  const day = d.getDate();
  return `${month} ${day} · ${formatTime(d)}`;
}

/**
 * Format a Date as RFC3339 in the given timezone, e.g.
 *   2026-05-07T15:00:00+05:30
 *
 * Currently hardcoded to Asia/Kolkata — the `timezone` parameter is accepted
 * for future-proofing but only "Asia/Kolkata" is supported. We avoid
 * Intl.DateTimeFormat tz parts here for determinism (tested formatting,
 * fixed offset, no DST drift).
 */
export function formatForGCal(d: Date, timezone: string): string {
  if (timezone !== 'Asia/Kolkata') {
    throw new Error(
      `formatForGCal only supports 'Asia/Kolkata' for now (got '${timezone}')`,
    );
  }

  // Shift UTC instant by +05:30 to read wall-clock parts.
  const istMillis = d.getTime() + KOLKATA_OFFSET_MINUTES * 60_000;
  const ist = new Date(istMillis);
  const yyyy = ist.getUTCFullYear();
  const mm = pad2(ist.getUTCMonth() + 1);
  const dd = pad2(ist.getUTCDate());
  const hh = pad2(ist.getUTCHours());
  const mi = pad2(ist.getUTCMinutes());
  const ss = pad2(ist.getUTCSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+05:30`;
}

/**
 * Human-readable relative time, falling back to absolute when the gap exceeds
 * a day. Pure function — caller is responsible for re-rendering when "now"
 * changes (e.g. a 60s setInterval tick).
 */
export function formatRelative(then: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 60_000) return 'just now';
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min ago`;

  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  const time = formatTime(then);
  return sameDay ? `today at ${time}` : `${then.toLocaleDateString()} ${time}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
