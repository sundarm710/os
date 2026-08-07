import { useCallback, useEffect, useState } from 'react';
import {
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  fetchProjectStats,
  renameProject as renameProjectApi,
  type ProjectStat,
} from './api';

/**
 * State for the Projects manager. Every mutation refetches rather than patching
 * locally: rename and delete both move tasks between Obsidian notes, so the
 * server's counts are the only trustworthy ones afterwards.
 *
 * `onChanged` lets the caller resync the task list, whose project labels go
 * stale the moment a project is renamed or deleted.
 */
export function useProjects(onChanged?: () => void) {
  const [stats, setStats] = useState<ProjectStat[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [busyProject, setBusyProject] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await fetchProjectStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Each mutation returns a boolean so callers can keep an editor open on
  // failure instead of collapsing it as though the change had landed.
  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
      setBusyProject(key);
      setError(null);
      try {
        await fn();
        await refresh();
        onChanged?.();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusyProject(null);
      }
    },
    [refresh, onChanged],
  );

  const create = useCallback(
    (name: string) => run(name, () => createProjectApi(name)),
    [run],
  );

  const rename = useCallback(
    (from: string, to: string) => run(from, () => renameProjectApi(from, to)),
    [run],
  );

  const remove = useCallback(
    (name: string) => run(name, () => deleteProjectApi(name)),
    [run],
  );

  return { stats, loading, error, busyProject, refresh, create, rename, remove };
}
