// Flow-specific webhook clients. Pure dispatch — auth, retries, and queue
// behaviour live elsewhere (webhookClient.ts, sync.ts, queue.ts).

import { postJson } from './webhookClient';

// The PWA composes the full thought_log body (including any "[mood: N]"
// prefix) and hands it to n8n as a single string. n8n only prepends the
// timestamp and writes to vault — it does not parse the text.
export type JournalPayload = {
  client_id: string;
  client_timestamp: string;
  text: string;
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

export type TaskCategory =
  | 'OVERDUE'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'FUTURE'
  | 'NO_DATE';

export type TaskStatus = 'open' | 'done';

export type Task = {
  id: string;
  text: string;
  project: string;
  due: string | null; // YYYY-MM-DD or null
  est: string | null;
  priority: string | null;
  depends_on: string | null;
  is_routine: boolean;
  status: TaskStatus;
  category?: TaskCategory; // present on open tasks
  completed?: string; // YYYY-MM-DD, present on done tasks
};

type TasksResponse = { tasks: Task[] };

const JOURNAL_URL = import.meta.env.VITE_WEBHOOK_JOURNAL_URL;
const CALENDAR_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_URL;
const CALENDAR_FETCH_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_FETCH_URL;
const TASKS_URL = import.meta.env.VITE_WEBHOOK_TASKS_URL;

export async function postJournal(payload: JournalPayload): Promise<void> {
  await postJson(JOURNAL_URL, payload);
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

export async function fetchOpenTasks(): Promise<Task[]> {
  const res = await postJson(TASKS_URL, { action: 'list' });
  const data = (await res.json()) as TasksResponse;
  return data.tasks ?? [];
}

export async function fetchDoneTasks(): Promise<Task[]> {
  const res = await postJson(TASKS_URL, { action: 'list_done' });
  const data = (await res.json()) as TasksResponse;
  return data.tasks ?? [];
}

type TaskActionRequest =
  | { action: 'done'; id: string }
  | { action: 'due'; id: string; date: string | null };
type TaskActionResponse = { ok: true; task: Task } | { ok: false; error: string };

export async function postTaskAction(request: TaskActionRequest): Promise<Task> {
  const res = await postJson(TASKS_URL, request);
  const data = (await res.json()) as TaskActionResponse;
  if (!data.ok) throw new Error(data.error);
  return data.task;
}
