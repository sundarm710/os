// Flow-specific webhook clients. Pure dispatch — auth, retries, and queue
// behaviour live elsewhere (webhookClient.ts, sync.ts, queue.ts).

import { postJson } from './webhookClient';

export type MoodPayload = {
  client_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string | null;
  client_timestamp: string;
};

export type CalendarPayload = {
  client_id: string;
  title: string;
  start_time: string; // RFC3339 with offset, e.g. "2026-05-07T15:00:00+05:30"
  end_time: string;
  timezone: string; // IANA name, e.g. "Asia/Kolkata"
};

export type CalendarEvent = {
  id: string;
  title: string;
  // All-day: 'YYYY-MM-DD' (end is exclusive, GCal convention).
  // Timed: full RFC3339 with offset.
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
};

type FetchResponse =
  | { ok: true; count: number; events: CalendarEvent[] }
  | { ok: false; reason: string };

const MOOD_URL = import.meta.env.VITE_WEBHOOK_URL;
const CALENDAR_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_URL;
const CALENDAR_FETCH_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_FETCH_URL;

export async function postMood(payload: MoodPayload): Promise<void> {
  await postJson(MOOD_URL, payload);
}

export async function postCalendar(payload: CalendarPayload): Promise<void> {
  await postJson(CALENDAR_URL, payload);
}

export async function fetchCalendarEvents(
  range?: { timeMin?: string; timeMax?: string },
): Promise<CalendarEvent[]> {
  const res = await postJson(CALENDAR_FETCH_URL, range ?? {});
  const data = (await res.json()) as FetchResponse;
  if (!data.ok) throw new Error(data.reason || 'calendar fetch failed');
  return data.events;
}
