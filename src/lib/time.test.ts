import { describe, it, expect } from 'vitest';
import {
  addMinutes,
  formatDateTime,
  formatDayLabel,
  formatForGCal,
  formatRelative,
  formatTime,
  kolkataDateString,
  nextQuarterHour,
  previousQuarterHour,
  snapToQuarterHour,
} from './time';

// Helpers — local-time constructors to keep tests readable.
function localDate(y: number, m: number, d: number, h: number, min: number, s = 0, ms = 0): Date {
  return new Date(y, m - 1, d, h, min, s, ms);
}

describe('addMinutes', () => {
  it('adds positive minutes', () => {
    const d = new Date('2026-05-07T10:00:00Z');
    expect(addMinutes(d, 30).toISOString()).toBe('2026-05-07T10:30:00.000Z');
  });

  it('subtracts via negative minutes', () => {
    const d = new Date('2026-05-07T10:00:00Z');
    expect(addMinutes(d, -30).toISOString()).toBe('2026-05-07T09:30:00.000Z');
  });

  it('does not mutate the input', () => {
    const d = new Date('2026-05-07T10:00:00Z');
    addMinutes(d, 60);
    expect(d.toISOString()).toBe('2026-05-07T10:00:00.000Z');
  });
});

describe('nextQuarterHour', () => {
  it('rounds up to the next :15 mid-quarter', () => {
    const out = nextQuarterHour(localDate(2026, 5, 7, 10, 7));
    expect(out.getHours()).toBe(10);
    expect(out.getMinutes()).toBe(15);
    expect(out.getSeconds()).toBe(0);
    expect(out.getMilliseconds()).toBe(0);
  });

  it('advances to next quarter even when exactly on a boundary', () => {
    const out = nextQuarterHour(localDate(2026, 5, 7, 10, 0));
    expect(out.getMinutes()).toBe(15);
  });

  it('rolls over to the next hour at :53', () => {
    const out = nextQuarterHour(localDate(2026, 5, 7, 10, 53));
    expect(out.getHours()).toBe(11);
    expect(out.getMinutes()).toBe(0);
  });

  it('rolls over to next day at 23:53', () => {
    const out = nextQuarterHour(localDate(2026, 5, 7, 23, 53));
    expect(out.getDate()).toBe(8);
    expect(out.getHours()).toBe(0);
    expect(out.getMinutes()).toBe(0);
  });

  it('clears sub-minute precision', () => {
    const out = nextQuarterHour(localDate(2026, 5, 7, 10, 14, 59, 999));
    expect(out.getHours()).toBe(10);
    expect(out.getMinutes()).toBe(15);
    expect(out.getSeconds()).toBe(0);
  });
});

describe('previousQuarterHour', () => {
  it('rounds back to the most recent :15 mid-quarter', () => {
    const out = previousQuarterHour(localDate(2026, 5, 7, 10, 23));
    expect(out.getHours()).toBe(10);
    expect(out.getMinutes()).toBe(15);
    expect(out.getSeconds()).toBe(0);
    expect(out.getMilliseconds()).toBe(0);
  });

  it('returns the same boundary when input is exactly on :15', () => {
    const out = previousQuarterHour(localDate(2026, 5, 7, 10, 15, 0, 0));
    expect(out.getHours()).toBe(10);
    expect(out.getMinutes()).toBe(15);
    expect(out.getSeconds()).toBe(0);
  });

  it('zeroes seconds/ms when input is just past a boundary', () => {
    const out = previousQuarterHour(localDate(2026, 5, 7, 10, 15, 30, 250));
    expect(out.getMinutes()).toBe(15);
    expect(out.getSeconds()).toBe(0);
    expect(out.getMilliseconds()).toBe(0);
  });

  it('falls back to :00 when sub-15-min into the hour', () => {
    const out = previousQuarterHour(localDate(2026, 5, 7, 10, 5));
    expect(out.getMinutes()).toBe(0);
  });

  it('does not cross hour or day boundaries backward', () => {
    // 00:05 → 00:00 (same day)
    const out = previousQuarterHour(localDate(2026, 5, 7, 0, 5));
    expect(out.getDate()).toBe(7);
    expect(out.getHours()).toBe(0);
    expect(out.getMinutes()).toBe(0);
  });
});

describe('snapToQuarterHour', () => {
  it('snaps backward when < 7.5 min past a boundary', () => {
    const out = snapToQuarterHour(localDate(2026, 5, 7, 10, 17));
    expect(out.getMinutes()).toBe(15);
  });

  it('snaps forward when ≥ 7.5 min past a boundary', () => {
    const out = snapToQuarterHour(localDate(2026, 5, 7, 10, 23));
    expect(out.getMinutes()).toBe(30);
  });

  it('stays put on exact boundary', () => {
    const out = snapToQuarterHour(localDate(2026, 5, 7, 10, 30));
    expect(out.getMinutes()).toBe(30);
  });
});

describe('formatTime', () => {
  it('formats AM hours', () => {
    expect(formatTime(localDate(2026, 5, 7, 9, 30))).toBe('9:30 AM');
  });

  it('formats PM hours with am/pm boundary', () => {
    expect(formatTime(localDate(2026, 5, 7, 14, 5))).toBe('2:05 PM');
  });

  it('handles midnight and noon edge cases', () => {
    expect(formatTime(localDate(2026, 5, 7, 0, 0))).toBe('12:00 AM');
    expect(formatTime(localDate(2026, 5, 7, 12, 0))).toBe('12:00 PM');
  });
});

describe('formatDateTime', () => {
  it('combines short month name, day-of-month, and 12-hour time', () => {
    expect(formatDateTime(localDate(2026, 5, 7, 14, 45))).toBe('May 7 · 2:45 PM');
  });

  it('handles single-digit day without padding', () => {
    expect(formatDateTime(localDate(2026, 5, 1, 9, 0))).toBe('May 1 · 9:00 AM');
  });

  it('handles midnight as 12:00 AM with the new day', () => {
    expect(formatDateTime(localDate(2026, 5, 8, 0, 0))).toBe('May 8 · 12:00 AM');
  });
});

describe('formatForGCal', () => {
  it('produces RFC3339 with +05:30 offset for IST wall-clock 3 PM', () => {
    // 2026-05-07 15:00 IST = 09:30 UTC
    const utc = new Date(Date.UTC(2026, 4, 7, 9, 30, 0));
    expect(formatForGCal(utc, 'Asia/Kolkata')).toBe('2026-05-07T15:00:00+05:30');
  });

  it('handles midnight IST correctly (previous UTC day)', () => {
    // 2026-05-07 00:00 IST = 2026-05-06 18:30 UTC
    const utc = new Date(Date.UTC(2026, 4, 6, 18, 30, 0));
    expect(formatForGCal(utc, 'Asia/Kolkata')).toBe('2026-05-07T00:00:00+05:30');
  });

  it('throws for unsupported timezones', () => {
    expect(() => formatForGCal(new Date(), 'America/New_York')).toThrow(
      /only supports 'Asia\/Kolkata'/,
    );
  });
});

describe('kolkataDateString', () => {
  it('returns the IST wall-clock day for a UTC instant in the same day', () => {
    // 2026-05-07 15:00 IST = 2026-05-07 09:30 UTC
    expect(kolkataDateString(new Date(Date.UTC(2026, 4, 7, 9, 30, 0)))).toBe('2026-05-07');
  });

  it('rolls into the next IST day before UTC midnight', () => {
    // 2026-05-08 00:30 IST = 2026-05-07 19:00 UTC
    expect(kolkataDateString(new Date(Date.UTC(2026, 4, 7, 19, 0, 0)))).toBe('2026-05-08');
  });
});

describe('formatDayLabel', () => {
  it('returns "Today" for a date on the same IST day as now', () => {
    const now = new Date(Date.UTC(2026, 4, 7, 9, 30, 0));
    const same = new Date(Date.UTC(2026, 4, 7, 12, 0, 0));
    expect(formatDayLabel(same, now)).toBe('Today');
  });

  it('returns "Tomorrow" for the next IST day', () => {
    const now = new Date(Date.UTC(2026, 4, 7, 9, 30, 0));
    const next = new Date(Date.UTC(2026, 4, 8, 9, 30, 0));
    expect(formatDayLabel(next, now)).toBe('Tomorrow');
  });

  it('returns "Yesterday" for the prior IST day', () => {
    const now = new Date(Date.UTC(2026, 4, 7, 9, 30, 0));
    const prior = new Date(Date.UTC(2026, 4, 6, 9, 30, 0));
    expect(formatDayLabel(prior, now)).toBe('Yesterday');
  });

  it('falls back to "MMM D" for further-out dates', () => {
    const now = new Date(Date.UTC(2026, 4, 7, 9, 30, 0));
    const far = new Date(Date.UTC(2026, 4, 12, 9, 30, 0));
    expect(formatDayLabel(far, now)).toBe('May 12');
  });
});

describe('formatRelative', () => {
  it('returns "just now" within the first minute', () => {
    const now = new Date('2026-05-07T10:00:00Z');
    const then = new Date('2026-05-07T09:59:30Z');
    expect(formatRelative(then, now)).toBe('just now');
  });

  it('returns "X min ago" for sub-hour gaps', () => {
    const now = new Date('2026-05-07T10:30:00Z');
    const then = new Date('2026-05-07T10:00:00Z');
    expect(formatRelative(then, now)).toBe('30 min ago');
  });

  it('returns "today at HH:MM" for sub-day gaps in the same calendar day', () => {
    const now = localDate(2026, 5, 7, 18, 0);
    const then = localDate(2026, 5, 7, 9, 30);
    expect(formatRelative(then, now)).toMatch(/today at 9:30 AM/);
  });
});
