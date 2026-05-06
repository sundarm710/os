import { useEffect, useState } from 'react';
import {
  getPending,
  STUCK_ATTEMPT_THRESHOLD,
  subscribe,
  type QueuedEntry,
} from './queue';

type Snapshot = {
  entries: QueuedEntry[];
  pendingCount: number;
  stuckCount: number;
};

const empty: Snapshot = { entries: [], pendingCount: 0, stuckCount: 0 };

export function usePendingQueue(): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(empty);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const entries = await getPending();
      if (cancelled) return;
      setSnap({
        entries,
        pendingCount: entries.length,
        stuckCount: entries.filter((e) => e.attempts >= STUCK_ATTEMPT_THRESHOLD)
          .length,
      });
    };
    void refresh();
    const unsub = subscribe(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return snap;
}
