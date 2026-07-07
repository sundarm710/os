// Flow-specific webhook clients. Pure dispatch — auth, retries, and queue
// behaviour live elsewhere (webhookClient.ts, sync.ts, queue.ts).

import { kolkataDateString, shiftKolkataDate } from './time';
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

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type Task = {
  id: string | null;
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
  // ISO local-ish: "YYYY-MM-DDTHH:MM" when a calendar block exists,
  // "YYYY-MM-DD" when only an Obsidian-Tasks ⏳ date was set manually,
  // null/absent when unscheduled.
  scheduled_at?: string | null;
};

type TasksResponse = { tasks: Task[] };

const DAILY_NOTE_URL = import.meta.env.VITE_WEBHOOK_DAILY_NOTE_URL;
const PEOPLE_URL = import.meta.env.VITE_WEBHOOK_PEOPLE_URL;
const JOURNAL_URL = import.meta.env.VITE_WEBHOOK_JOURNAL_URL;
const JOURNAL_FETCH_URL = import.meta.env.VITE_WEBHOOK_JOURNAL_FETCH_URL;
const CALENDAR_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_URL;
const CALENDAR_FETCH_URL = import.meta.env.VITE_WEBHOOK_CALENDAR_FETCH_URL;
const TASKS_URL = import.meta.env.VITE_WEBHOOK_TASKS_URL;
const WORKOUTS_FETCH_URL = import.meta.env.VITE_WEBHOOK_WORKOUTS_FETCH_URL;
const NOTES_URL = import.meta.env.VITE_WEBHOOK_NOTES_URL;

export type WorkoutSessionType = 'strength' | 'cardio';
export type WorkoutFetchType = WorkoutSessionType | 'all';

export type WorkoutSetStatus = 'completed' | 'skipped' | 'failed';

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'mobility' | 'cardio';

export type SessionSplit =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full'
  | 'home' | 'mobility' | 'cardio';

export type WorkoutSet = {
  set_number: number;
  weight_kg: number | null;
  left_weight_kg: number | null;
  right_weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  status: WorkoutSetStatus | string;
  feel_notes: string | null;
  cue_notes: string | null;
};

export type WorkoutExercise = {
  exercise_name: string;
  exercise_category: 'warmup' | 'main' | 'cooldown' | string;
  muscle_group: MuscleGroup | string | null;
  modality: 'bilateral' | 'unilateral' | 'timed_unilateral' | 'timed' | string;
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: number;
  date: string; // ISO date string (often UTC midnight); render in Asia/Kolkata
  session_type: WorkoutSessionType;
  split: SessionSplit | string | null;
  program_phase: number | null;
  program_week: number | null;
  overall_feel: string | null;
  exercises: WorkoutExercise[];
  copy_text: string;
};

type WorkoutsResponse =
  | { ok: true; sessions: WorkoutSession[] }
  | { ok: false; reason: string };

export type WorkoutsFetchOptions = {
  type?: WorkoutFetchType;
  limit?: number;
  before_date?: string;
};

export type DailyNoteFieldType = 'boolean' | 'rating' | 'number' | 'text';

export type DailyNoteField = {
  key: string;
  type: DailyNoteFieldType;
  label: string;
};

type DailyNoteSchemaResponse =
  | { ok: true; fields: DailyNoteField[] }
  | { ok: false; error: string };

type DailyNoteFetchResponse =
  | { ok: true; found: boolean; values: Record<string, string> }
  | { ok: false; error: string };

type DailyNoteSaveResponse =
  | { ok: true; date: string; updated: number }
  | { ok: false; error: string };

export async function fetchDailyNoteSchema(): Promise<DailyNoteField[]> {
  const res = await postJson(DAILY_NOTE_URL, { action: 'schema' });
  const data = (await res.json()) as DailyNoteSchemaResponse;
  if (!data.ok) throw new Error(data.error || 'schema fetch failed');
  return data.fields;
}

export async function fetchDailyNote(date: string): Promise<Record<string, string>> {
  const res = await postJson(DAILY_NOTE_URL, { action: 'fetch', date });
  const data = (await res.json()) as DailyNoteFetchResponse;
  if (!data.ok) throw new Error(data.error || 'daily note fetch failed');
  return data.values;
}

export async function saveDailyNote(
  date: string,
  values: Record<string, string>,
): Promise<void> {
  const res = await postJson(DAILY_NOTE_URL, { action: 'save', date, values });
  const data = (await res.json()) as DailyNoteSaveResponse;
  if (!data.ok) throw new Error(data.error || 'daily note save failed');
}

export async function postJournal(payload: JournalPayload): Promise<void> {
  await postJson(JOURNAL_URL, payload);
}

export type JournalLog = {
  client_id: string;
  type: string;
  entry_date: string; // ISO date (often UTC midnight)
  entry_time: string; // HH:MM:SS, IST wall-clock
  client_timestamp: string; // full RFC3339
  mood: number | null;
  text: string;
  source: string;
};

type JournalFetchResponse =
  | { ok: true; logs: JournalLog[] }
  | { ok: false; reason: string };

export async function fetchJournalLogs(
  options: { limit?: number; before_date?: string } = {},
): Promise<JournalLog[]> {
  const body: Record<string, unknown> = {};
  if (options.limit != null) body.limit = options.limit;
  if (options.before_date) body.before_date = options.before_date;
  const res = await postJson(JOURNAL_FETCH_URL, body);
  const data = (await res.json()) as JournalFetchResponse;
  if (!data.ok) throw new Error(data.reason || 'journal fetch failed');
  return data.logs;
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

/**
 * Bucket a task's due date into a category in Asia/Kolkata wall-clock.
 *
 * The PWA owns this because the server's notion of "today" can drift from
 * the user's IST day (n8n + Python on a UTC VPS produced a TODAY-section
 * that was empty in the evening — server "today" was UTC's tomorrow). By
 * recomputing client-side after every fetch, the categories always match
 * the user's local day even if the server is wrong.
 */
export function computeCategory(
  due: string | null,
  now: Date = new Date(),
): TaskCategory {
  if (!due) return 'NO_DATE';
  const todayKey = kolkataDateString(now);
  if (due < todayKey) return 'OVERDUE';
  if (due === todayKey) return 'TODAY';
  // THIS_WEEK = +1..+6 days from today (rolling). Beyond is FUTURE.
  const weekEdgeKey = shiftKolkataDate(now, 6);
  if (due <= weekEdgeKey) return 'THIS_WEEK';
  return 'FUTURE';
}

export async function fetchOpenTasks(): Promise<Task[]> {
  const res = await postJson(TASKS_URL, { action: 'list' });
  const data = (await res.json()) as TasksResponse;
  const now = new Date();
  // Re-bucket with IST-aware logic — see computeCategory comment.
  return (data.tasks ?? []).map((t) => ({
    ...t,
    category: t.status === 'done' ? t.category : computeCategory(t.due, now),
  }));
}

export async function fetchDoneTasks(): Promise<Task[]> {
  const res = await postJson(TASKS_URL, { action: 'list_done' });
  const data = (await res.json()) as TasksResponse;
  return data.tasks ?? [];
}

type TaskActionRequest =
  | { action: 'done'; id: string }
  | { action: 'start'; id: string }
  | { action: 'cancel'; id: string }
  | { action: 'status'; id: string; status: TaskStatus }
  | { action: 'due'; id: string; date: string | null }
  | { action: 'schedule'; id: string; date: string; time: string }
  | {
      action: 'add';
      text: string;
      project?: string;
      due?: string | null;
      est?: string;
      after?: string;
      recur?: string;
    };
type TaskActionResponse = { ok: true; task: Task } | { ok: false; error: string };

export async function postTaskAction(request: TaskActionRequest): Promise<Task> {
  const res = await postJson(TASKS_URL, request);
  const data = (await res.json()) as TaskActionResponse;
  if (!data.ok) throw new Error(data.error);
  const task = data.task;
  return {
    ...task,
    category: task.status === 'done' ? task.category : computeCategory(task.due),
  };
}

export async function fetchWorkouts(
  options: WorkoutsFetchOptions = {},
): Promise<WorkoutSession[]> {
  const body: Record<string, unknown> = {};
  if (options.type) body.type = options.type;
  if (options.limit != null) body.limit = options.limit;
  if (options.before_date) body.before_date = options.before_date;
  const res = await postJson(WORKOUTS_FETCH_URL, body);
  const data = (await res.json()) as WorkoutsResponse;
  if (!data.ok) throw new Error(data.reason || 'workouts fetch failed');
  return data.sessions;
}

export async function fetchProjects(): Promise<string[]> {
  const res = await postJson(TASKS_URL, { action: 'projects' });
  const data = (await res.json()) as { projects?: string[] };
  return data.projects ?? [];
}

// ─── People ──────────────────────────────────────────────────────────────────

export type ContactStatus = 'active' | 'no_contact';

export type PersonSummary = {
  name: string;
  filePath: string;
  lastContacted: string | null;
  birthday: string | null;
  preview: string | null;
  snoozeUntil: string | null;
  contactStatus: ContactStatus;
};

export type PersonSearchResult = {
  name: string;
  filePath: string;
  score: number;
  isPeople: boolean;
  contentExcerpt: string | null;
};

export type PersonDetail = {
  frontmatter: Record<string, string>;
  interactions: Array<{ date: string; text: string }>;
  rawBody: string;
};

export async function fetchPeople(): Promise<PersonSummary[]> {
  const res = await postJson(PEOPLE_URL, { action: 'list' });
  const data = (await res.json()) as { people: PersonSummary[] };
  return data.people ?? [];
}

export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  const res = await postJson(PEOPLE_URL, { action: 'search', query });
  const data = (await res.json()) as { results: PersonSearchResult[] };
  return data.results ?? [];
}

export async function fetchPerson(filePath: string): Promise<PersonDetail> {
  const res = await postJson(PEOPLE_URL, { action: 'fetch', filePath });
  return (await res.json()) as PersonDetail;
}

export async function savePerson(
  filePath: string,
  date: string,
  text: string,
  fmUpdates: Record<string, string>,
): Promise<void> {
  await postJson(PEOPLE_URL, { action: 'save', filePath, date, text, fmUpdates });
}

export async function createPerson(
  name: string,
  birthday: string,
  howKnow: string,
  keyFacts: string,
): Promise<{ filePath: string; name: string }> {
  const res = await postJson(PEOPLE_URL, { action: 'create', name, birthday, howKnow, keyFacts });
  return (await res.json()) as { filePath: string; name: string };
}

// ─── Notes (vault browser) ─────────────────────────────────────────────────────

export type NoteSearchResult = {
  title: string;
  path: string;
  folder: string;
  score: number;
  snippet: string;
  matchType: 'title' | 'content' | string;
};

// A resolved wikilink. `exists: false` means the target note isn't in the vault
// yet (an unresolved [[link]]) — the UI renders those as non-navigable.
export type NoteLink = {
  title: string;
  path: string;
  exists: boolean;
  excerpt: string;
};

export type NoteBacklink = {
  title: string;
  path: string;
  excerpt: string;
};

export type NoteDetail = {
  title: string;
  path: string;
  folder: string;
  frontmatter: Record<string, string>;
  tags: string[];
  body: string;
  outgoing: NoteLink[];
  backlinks: NoteBacklink[];
};

export async function searchNotes(query: string): Promise<NoteSearchResult[]> {
  const res = await postJson(NOTES_URL, { action: 'search', query });
  const data = (await res.json()) as { ok?: boolean; results?: NoteSearchResult[] };
  return data.results ?? [];
}

export async function fetchNote(path: string): Promise<NoteDetail> {
  const res = await postJson(NOTES_URL, { action: 'get', path });
  const data = (await res.json()) as ({ ok: true } & NoteDetail) | { ok: false; error: string };
  if (!('ok' in data) || !data.ok) {
    throw new Error(('error' in data && data.error) || 'note not found');
  }
  const { ...note } = data;
  return note as NoteDetail;
}
