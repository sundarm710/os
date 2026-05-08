import { useCallback, useEffect, useState } from 'react';
import {
  fetchDoneTasks,
  fetchOpenTasks,
  postTaskAction,
  type Task,
  type TaskCategory,
} from './api';
import { kolkataDateString, shiftKolkataDate } from './time';

export function useTasks() {
  const [open, setOpen] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOpen, nextDone] = await Promise.all([
        fetchOpenTasks(),
        fetchDoneTasks(),
      ]);
      setOpen(nextOpen);
      setDone(nextDone);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark a task done with optimistic UI: remove from open + insert into done
  // immediately, fire the server action, replace with the server's task object
  // on success or revert both lists on failure. Mutations don't go through the
  // queue — done is a read-modify-write against backend state, where stale
  // operations could conflict with the real source of truth.
  const complete = useCallback(
    async (id: string) => {
      const snapshot = open.find((t) => t.id === id);
      if (!snapshot) return;

      const optimistic: Task = {
        ...snapshot,
        status: 'done',
        completed: kolkataDateString(new Date()),
      };

      setOpen((prev) => prev.filter((t) => t.id !== id));
      setDone((prev) => [optimistic, ...prev]);

      try {
        const updated = await postTaskAction({ action: 'done', id });
        setDone((prev) => [updated, ...prev.filter((t) => t.id !== id)]);
        setError(null);
      } catch (e) {
        setOpen((prev) => [snapshot, ...prev]);
        setDone((prev) => prev.filter((t) => t.id !== id));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [open],
  );

  // Reschedule a task to a new YYYY-MM-DD or null (clear). Same optimistic
  // pattern as complete(): swap the task in-place with new due + recomputed
  // category, fire the action, replace with server's authoritative task on
  // success or revert on failure. Category is approximated client-side; the
  // server response corrects it (e.g. for week-boundary differences).
  const reschedule = useCallback(
    async (id: string, date: string | null) => {
      const snapshot = open.find((t) => t.id === id);
      if (!snapshot) return;

      const optimistic: Task = {
        ...snapshot,
        due: date,
        category: computeCategory(date, new Date()),
      };

      setOpen((prev) => prev.map((t) => (t.id === id ? optimistic : t)));

      try {
        const updated = await postTaskAction({ action: 'due', id, date });
        setOpen((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setError(null);
      } catch (e) {
        setOpen((prev) => prev.map((t) => (t.id === id ? snapshot : t)));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [open],
  );

  useEffect(() => {
    void refresh();
    function onVisibility() {
      if (document.visibilityState === 'visible') void refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return { open, done, loading, error, refresh, complete, reschedule };
}

function computeCategory(date: string | null, now: Date): TaskCategory {
  if (!date) return 'NO_DATE';
  const todayKey = kolkataDateString(now);
  if (date < todayKey) return 'OVERDUE';
  if (date === todayKey) return 'TODAY';
  // THIS_WEEK = +1..+6 days from today (rolling). Beyond is FUTURE.
  const weekEdgeKey = shiftKolkataDate(now, 6);
  if (date <= weekEdgeKey) return 'THIS_WEEK';
  return 'FUTURE';
}
