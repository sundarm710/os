import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear } from 'idb-keyval';

// Mock the api module so we can drive dispatcher outcomes deterministically.
const postJournal = vi.fn();
const postCalendar = vi.fn();
vi.mock('./api', () => ({
  postJournal: (...args: unknown[]) => postJournal(...args),
  postCalendar: (...args: unknown[]) => postCalendar(...args),
}));

import { drainQueue } from './sync';
import { enqueue, getPending, newClientId } from './queue';

describe('drainQueue', () => {
  beforeEach(async () => {
    await clear();
    postJournal.mockReset();
    postCalendar.mockReset();
  });

  afterEach(async () => {
    await clear();
  });

  it('returns zero counts on empty queue', async () => {
    const out = await drainQueue();
    expect(out).toEqual({ sent: 0, failed: 0 });
    expect(postJournal).not.toHaveBeenCalled();
  });

  it('sends every entry and clears the queue when all succeed', async () => {
    postJournal.mockResolvedValue(undefined);
    postCalendar.mockResolvedValue(undefined);

    await enqueue('journal', { client_id: newClientId(), rating: 4 });
    await enqueue('calendar', { client_id: newClientId(), title: 'Build' });
    await enqueue('journal', { client_id: newClientId(), rating: 5 });

    const out = await drainQueue();

    expect(out).toEqual({ sent: 3, failed: 0 });
    expect(postJournal).toHaveBeenCalledTimes(2);
    expect(postCalendar).toHaveBeenCalledTimes(1);
    expect(await getPending()).toHaveLength(0);
  });

  it('stops on first failure and leaves remaining entries queued', async () => {
    postJournal
      .mockResolvedValueOnce(undefined) // first ok
      .mockRejectedValueOnce(new Error('boom')); // second fails — drain stops

    await enqueue('journal', { client_id: newClientId(), rating: 4 });
    await enqueue('journal', { client_id: newClientId(), rating: 4 });
    await enqueue('journal', { client_id: newClientId(), rating: 4 });

    const out = await drainQueue();

    expect(out).toEqual({ sent: 1, failed: 1 });
    // first removed, second + third still pending
    const pending = await getPending();
    expect(pending).toHaveLength(2);
    // Don't keep hammering after first failure.
    expect(postJournal).toHaveBeenCalledTimes(2);
  });

  it('increments attempts on the failing entry', async () => {
    postJournal.mockRejectedValue(new Error('500'));
    const id = newClientId();
    await enqueue('journal', { client_id: id, rating: 4 });

    await drainQueue();
    await drainQueue();

    const [entry] = await getPending();
    expect(entry?.id).toBe(id);
    expect(entry?.attempts).toBe(2);
  });

  it('processes oldest-first', async () => {
    postJournal.mockResolvedValue(undefined);
    const a = newClientId();
    const b = newClientId();
    await enqueue('journal', { client_id: a, rating: 1 });
    await enqueue('journal', { client_id: b, rating: 2 });

    await drainQueue();

    const calls = postJournal.mock.calls.map((c) => (c[0] as { client_id: string }).client_id);
    expect(calls).toEqual([a, b]);
  });
});
