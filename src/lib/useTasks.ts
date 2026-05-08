import { useCallback, useEffect, useState } from 'react';
import {
  fetchDoneTasks,
  fetchOpenTasks,
  fetchProjects,
  postTaskAction,
  type Task,
  type TaskCategory,
} from './api';
import { kolkataDateString, shiftKolkataDate } from './time';

export type AddTaskParams = {
  text: string;
  project?: string;
  due?: string | null;
  est?: string;
};

export function useTasks() {
  const [open, setOpen] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [projects, setProjects] = useState<string[] | null>(null);
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

  // Lazy projects fetch — triggered the first time the FAB opens. Cached
  // session-level; the projects list rarely changes mid-session, and a
  // refresh on next visit is cheap.
  const loadProjects = useCallback(async () => {
    if (projects !== null) return;
    try {
      const list = await fetchProjects();
      setProjects(list);
    } catch (e) {
      // Surface as banner so the AddTaskSheet still opens with no chips,
      // and the user can either type a new project or retry.
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projects]);

  // Add a new task. Server assigns id + computes category, so we don't
  // optimistically insert — we wait for the server response and prepend the
  // canonical task to the open list. Errors propagate so the sheet stays
  // open on failure.
  const addTask = useCallback(async (params: AddTaskParams) => {
    const created = await postTaskAction({
      action: 'add',
      text: params.text,
      ...(params.project !== undefined ? { project: params.project } : {}),
      ...(params.due !== undefined ? { due: params.due } : {}),
      ...(params.est !== undefined ? { est: params.est } : {}),
    });
    setOpen((prev) => [created, ...prev]);
    setError(null);
    if (params.project) {
      setProjects((prev) =>
        prev && !prev.includes(params.project!)
          ? [...prev, params.project!].sort()
          : prev,
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    function onVisibility() {
      if (document.visibilityState === 'visible') void refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return {
    open,
    done,
    projects,
    loading,
    error,
    refresh,
    complete,
    reschedule,
    addTask,
    loadProjects,
  };
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
