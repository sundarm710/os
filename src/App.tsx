import { useEffect, useState } from 'react';
import { useDrainQueue } from './lib/useDrainQueue';
import { useIsKeyboardDevice } from './lib/usePlatform';
import { DEFAULT_PAGE, PAGES, type Page } from './routes';
import Chat from './pages/Chat';
import Tasks from './pages/Tasks';
import Journal from './pages/Journal';
import DailyNote from './pages/DailyNote';
import Calendar from './pages/Calendar';
import Workouts from './pages/Workouts';
import Learn from './pages/Learn';
import People from './pages/People';
import Notes from './pages/Notes';
import { TabBar } from './components/TabBar';
import { LoginGate } from './components/LoginGate';

export default function App() {
  useDrainQueue();
  const [page, setPage] = useState<Page>(DEFAULT_PAGE);
  const isKeyboard = useIsKeyboardDevice();

  // Shift+1…Shift+8 jump to a tab (in TabBar order). Keyed off event.code
  // ('Digit1'…) so it's layout-independent and, crucially, doesn't collide
  // with typing '@'/'#' (Shift+2/3 on US layouts) — the isTyping() guard skips
  // the shortcut whenever a text field is focused.
  useEffect(() => {
    if (!isKeyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const m = /^Digit([1-9])$/.exec(e.code);
      if (!m) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      const idx = parseInt(m[1], 10) - 1;
      if (idx < PAGES.length) {
        e.preventDefault();
        setPage(PAGES[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isKeyboard]);

  return (
    <LoginGate>
      <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-24 pt-12">
        {page === 'chat' && <Chat />}
        {page === 'tasks' && <Tasks onNavigate={setPage} />}
        {page === 'journal' && <Journal />}
        {page === 'daily-note' && <DailyNote />}
        {page === 'calendar' && <Calendar />}
        {page === 'workouts' && <Workouts />}
        {page === 'learn' && <Learn />}
        {page === 'people' && <People />}
        {page === 'notes' && <Notes />}
      </main>
      <TabBar active={page} onChange={setPage} showShortcuts={isKeyboard} />
    </LoginGate>
  );
}
