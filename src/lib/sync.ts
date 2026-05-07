import { postCalendar, postJournal, type CalendarPayload, type JournalPayload } from './api';
import {
  getPending,
  incrementAttempts,
  markDone,
  type QueuedEntry,
} from './queue';

// Drain the queue oldest-first. Stops on first failure so we don't hammer
// a sad endpoint. Returns counts so callers can drive UX.
export async function drainQueue(): Promise<{ sent: number; failed: number }> {
  const pending = await getPending();
  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await dispatch(entry);
      await markDone(entry.id);
      sent += 1;
    } catch {
      await incrementAttempts(entry.id);
      failed += 1;
      break;
    }
  }
  return { sent, failed };
}

const dispatchers: {
  [K in QueuedEntry['type']]: (payload: QueuedEntry['payload']) => Promise<void>;
} = {
  journal: (payload) => postJournal(payload as unknown as JournalPayload),
  calendar: (payload) => postCalendar(payload as unknown as CalendarPayload),
};

async function dispatch(entry: QueuedEntry): Promise<void> {
  const fn = dispatchers[entry.type];
  if (!fn) throw new Error(`No dispatcher for entry type: ${entry.type}`);
  return fn(entry.payload);
}
