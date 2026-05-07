import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import {
  enqueue,
  getPending,
  incrementAttempts,
  markDone,
  newClientId,
  STUCK_ATTEMPT_THRESHOLD,
  subscribe,
} from './queue';

describe('queue', () => {
  beforeEach(async () => {
    await clear();
  });

  afterEach(async () => {
    await clear();
  });

  describe('enqueue', () => {
    it('persists an entry with shared id and zero attempts', async () => {
      const client_id = newClientId();
      await enqueue('journal', { client_id, rating: 4 });
      const pending = await getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(client_id);
      expect(pending[0]?.type).toBe('journal');
      expect(pending[0]?.attempts).toBe(0);
      expect(pending[0]?.queued_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('preserves FIFO order across multiple enqueues', async () => {
      await enqueue('journal', { client_id: newClientId(), rating: 1 });
      await enqueue('calendar', { client_id: newClientId(), title: 'a' });
      await enqueue('journal', { client_id: newClientId(), rating: 2 });
      const pending = await getPending();
      expect(pending.map((p) => p.type)).toEqual(['journal', 'calendar', 'journal']);
    });
  });

  describe('markDone', () => {
    it('removes only the matching entry', async () => {
      const a = newClientId();
      const b = newClientId();
      await enqueue('journal', { client_id: a, rating: 4 });
      await enqueue('journal', { client_id: b, rating: 5 });
      await markDone(a);
      const pending = await getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(b);
    });

    it('is a no-op for unknown ids', async () => {
      await enqueue('journal', { client_id: newClientId(), rating: 4 });
      await markDone('does-not-exist');
      expect((await getPending()).length).toBe(1);
    });
  });

  describe('incrementAttempts', () => {
    it('bumps counter and records last_attempt_at', async () => {
      const id = newClientId();
      await enqueue('journal', { client_id: id, rating: 4 });
      await incrementAttempts(id);
      await incrementAttempts(id);
      const [entry] = await getPending();
      expect(entry?.attempts).toBe(2);
      expect(entry?.last_attempt_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('crosses STUCK_ATTEMPT_THRESHOLD only after enough increments', async () => {
      const id = newClientId();
      await enqueue('journal', { client_id: id, rating: 4 });
      for (let i = 0; i < STUCK_ATTEMPT_THRESHOLD - 1; i++) {
        await incrementAttempts(id);
      }
      let [entry] = await getPending();
      expect(entry?.attempts).toBeLessThan(STUCK_ATTEMPT_THRESHOLD);

      await incrementAttempts(id);
      [entry] = await getPending();
      expect(entry?.attempts).toBe(STUCK_ATTEMPT_THRESHOLD);
    });
  });

  describe('subscribe', () => {
    it('fires after every mutation', async () => {
      let count = 0;
      const unsub = subscribe(() => {
        count += 1;
      });

      const id = newClientId();
      await enqueue('journal', { client_id: id, rating: 4 });
      await incrementAttempts(id);
      await markDone(id);
      unsub();

      expect(count).toBe(3);
    });

    it('does not notify after unsubscribe', async () => {
      let count = 0;
      const unsub = subscribe(() => {
        count += 1;
      });
      unsub();
      await enqueue('journal', { client_id: newClientId(), rating: 4 });
      expect(count).toBe(0);
    });
  });

  describe('newClientId', () => {
    it('returns a UUIDv4', () => {
      const id = newClientId();
      // RFC 4122 v4: 8-4-4-4-12, version digit 4, variant 8|9|a|b
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('returns unique values across calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(newClientId());
      expect(ids.size).toBe(100);
    });
  });
});
