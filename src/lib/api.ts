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

const MOOD_URL = import.meta.env.VITE_WEBHOOK_URL;
const CALENDAR_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_URL;

export async function postMood(payload: MoodPayload): Promise<void> {
  await postJson(MOOD_URL, payload);
}

export async function postCalendar(payload: CalendarPayload): Promise<void> {
  await postJson(CALENDAR_URL, payload);
}
