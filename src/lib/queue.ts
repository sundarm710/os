import { update, get } from 'idb-keyval';

// Single-key array queue. idb-keyval's `update(key, fn)` is atomic per-key,
// so concurrent enqueue/markDone/incrementAttempts won't race each other.

const QUEUE_KEY = 'sundar:queue:v1';

export type QueuedEntry<TPayload = Record<string, unknown>> = {
  id: string;
  type: 'mood' | 'calendar';
  payload: TPayload;
  queued_at: string;
  attempts: number;
  last_attempt_at?: string;
};

export function newClientId(): string {
  return crypto.randomUUID();
}

export async function enqueue<T extends { client_id: string }>(
  type: QueuedEntry['type'],
  payload: T,
): Promise<QueuedEntry<T>> {
  const entry: QueuedEntry<T> = {
    id: payload.client_id,
    type,
    payload,
    queued_at: new Date().toISOString(),
    attempts: 0,
  };
  await update<QueuedEntry[]>(QUEUE_KEY, (existing) => [
    ...(existing ?? []),
    entry as QueuedEntry,
  ]);
  return entry;
}

export async function getPending(): Promise<QueuedEntry[]> {
  return (await get<QueuedEntry[]>(QUEUE_KEY)) ?? [];
}

export async function markDone(id: string): Promise<void> {
  await update<QueuedEntry[]>(QUEUE_KEY, (existing) =>
    (existing ?? []).filter((e) => e.id !== id),
  );
}

export async function incrementAttempts(id: string): Promise<void> {
  const now = new Date().toISOString();
  await update<QueuedEntry[]>(QUEUE_KEY, (existing) =>
    (existing ?? []).map((e) =>
      e.id === id ? { ...e, attempts: e.attempts + 1, last_attempt_at: now } : e,
    ),
  );
}
