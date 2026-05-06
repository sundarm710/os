import { postMood, type MoodPayload } from './api';
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

async function dispatch(entry: QueuedEntry): Promise<void> {
  switch (entry.type) {
    case 'mood':
      return postMood(entry.payload as unknown as MoodPayload);
    case 'calendar':
      throw new Error('Calendar dispatch lands on Day 4');
  }
}
