import { useCallback, useEffect, useState } from 'react';
import {
  completePartnerTask,
  fetchPartnerDoneTasks,
  fetchPartnerTasks,
  reopenPartnerTask,
  type PartnerPerson,
  type PartnerTask,
} from './api';
import { drainQueue } from './sync';
import { enqueue, newClientId } from './queue';

export function usePartnerTasks() {
  const [open, setOpen] = useState<PartnerTask[]>([]);
  const [done, setDone] = useState<PartnerTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOpen, nextDone] = await Promise.all([
        fetchPartnerTasks(),
        fetchPartnerDoneTasks(20),
      ]);
      setOpen(nextOpen);
      setDone(nextDone);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Queue-first, like journal/calendar: show the task immediately with a
  // client-generated id, enqueue for background send, and let the next
  // refresh (mount / visibilitychange) reconcile with the server's row —
  // the add is idempotent server-side on client_id, so a retried queue entry
  // never double-inserts.
  const addTask = useCallback(async (text: string, assignee: PartnerPerson | null) => {
    const client_id = newClientId();
    const optimistic: PartnerTask = {
      id: client_id,
      client_id,
      text,
      assignee,
      created_by: 'sundar', // display-only placeholder; server value wins on refresh
      status: 'open',
      completed_by: null,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    setOpen((prev) => [optimistic, ...prev]);
    await enqueue('partner-task', { client_id, text, assignee });
    void drainQueue().then(() => refresh());
  }, [refresh]);

  // Optimistic direct mutation (not queued) — completing/reopening is a
  // read-modify-write against backend state, same rationale as useTasks.ts.
  const complete = useCallback(
    async (id: string) => {
      const snapshot = open.find((t) => t.id === id);
      if (!snapshot) return;
      const optimistic: PartnerTask = { ...snapshot, status: 'done' };
      setOpen((prev) => prev.filter((t) => t.id !== id));
      setDone((prev) => [optimistic, ...prev]);
      try {
        const updated = await completePartnerTask(id);
        setDone((prev) => [updated, ...prev.filter((t) => t.id !== id)]);
      } catch (e) {
        setOpen((prev) => [snapshot, ...prev]);
        setDone((prev) => prev.filter((t) => t.id !== id));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [open],
  );

  const reopen = useCallback(
    async (id: string) => {
      const snapshot = done.find((t) => t.id === id);
      if (!snapshot) return;
      const optimistic: PartnerTask = { ...snapshot, status: 'open' };
      setDone((prev) => prev.filter((t) => t.id !== id));
      setOpen((prev) => [optimistic, ...prev]);
      try {
        const updated = await reopenPartnerTask(id);
        setOpen((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } catch (e) {
        setOpen((prev) => prev.filter((t) => t.id !== id));
        setDone((prev) => [snapshot, ...prev]);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [done],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { open, done, loading, error, refresh, addTask, complete, reopen };
}
