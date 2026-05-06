import { useEffect } from 'react';
import { drainQueue } from './sync';

// Belt-and-suspenders auto-drain. Browsers vary on `online` event reliability,
// so visibilitychange catches the case where the user backgrounds during an
// outage and foregrounds after reconnecting.
export function useDrainQueue() {
  useEffect(() => {
    void drainQueue();

    const onOnline = () => {
      void drainQueue();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void drainQueue();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
