import { useCallback, useEffect, useState } from 'react';
import {
  computeCategory,
  fetchDoneTasks,
  fetchOpenTasks,
  fetchProjects,
  postTaskAction,
  type Task,
} from './api';
import { kolkataDateString } from './time';

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

  // Tap a done task's checkbox to undo. Optimistically pull it back into the
  // open list with status='open' + recomputed category. On failure, reinsert
  // the snapshot into done. Backend uses the generic `status` action since
  // there's no dedicated `reopen` wrapper.
  const reopen = useCallback(
    async (id: string) => {
      const snapshot = done.find((t) => t.id === id);
      if (!snapshot) return;

      const optimistic: Task = {
        ...snapshot,
        status: 'open',
        completed: undefined,
        category: computeCategory(snapshot.due, new Date()),
      };

      setDone((prev) => prev.filter((t) => t.id !== id));
      setOpen((prev) => [optimistic, ...prev]);

      try {
        const updated = await postTaskAction({
          action: 'status',
          id,
          status: 'open',
        });
        setOpen((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setError(null);
      } catch (e) {
        setOpen((prev) => prev.filter((t) => t.id !== id));
        setDone((prev) => [snapshot, ...prev]);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [done],
  );

  // Cancel removes a task from view entirely — backend marks it `- [-] ❌`,
  // and neither the open nor done list returns cancelled tasks. Optimistic:
  // drop from open immediately; restore on failure.
  const cancel = useCallback(
    async (id: string) => {
      const snapshot = open.find((t) => t.id === id);
      if (!snapshot) return;

      setOpen((prev) => prev.filter((t) => t.id !== id));

      try {
        await postTaskAction({ action: 'cancel', id });
        setError(null);
      } catch (e) {
        setOpen((prev) => [snapshot, ...prev]);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [open],
  );

  // Long-press on the checkbox flips a task to in_progress. The task stays in
  // the open list (server's `list` includes both open + in_progress); the
  // checkbox tints amber until tapped to complete or reverted server-side.
  const start = useCallback(
    async (id: string) => {
      const snapshot = open.find((t) => t.id === id);
      if (!snapshot || snapshot.status === 'in_progress') return;

      const optimistic: Task = { ...snapshot, status: 'in_progress' };
      setOpen((prev) => prev.map((t) => (t.id === id ? optimistic : t)));

      try {
        const updated = await postTaskAction({ action: 'start', id });
        setOpen((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setError(null);
      } catch (e) {
        setOpen((prev) => prev.map((t) => (t.id === id ? snapshot : t)));
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
    reopen,
    cancel,
    start,
    reschedule,
    addTask,
    loadProjects,
  };
}
