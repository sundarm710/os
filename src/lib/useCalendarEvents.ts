import { useCallback, useEffect, useState } from 'react';
import { fetchCalendarEvents, type CalendarEvent } from './api';

const DAY_MS = 86_400_000;
// Symmetric one-week window. Tighter scope keeps the timeline focused on
// "now-ish" — the user can drag the Start dial up to 7 days either way.
const PAST_DAYS = 7;
const FUTURE_DAYS = 7;

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const timeMin = new Date(now - PAST_DAYS * DAY_MS).toISOString();
      const timeMax = new Date(now + FUTURE_DAYS * DAY_MS).toISOString();
      const next = await fetchCalendarEvents({ timeMin, timeMax });
      setEvents(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
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

  return { events, loading, error, refresh };
}
