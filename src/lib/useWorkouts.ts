import { useCallback, useEffect, useState } from 'react';
import {
  fetchWorkouts,
  type WorkoutFetchType,
  type WorkoutSession,
} from './api';

const DEFAULT_LIMIT = 20;

export function useWorkouts(type: WorkoutFetchType, limit: number = DEFAULT_LIMIT) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchWorkouts({ type, limit });
      next.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
      setSessions(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [type, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') void refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
