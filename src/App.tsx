import { useState } from 'react';
import { useDrainQueue } from './lib/useDrainQueue';
import { DEFAULT_PAGE, type Page } from './routes';
import Mood from './pages/Mood';
import Calendar from './pages/Calendar';
import { TabBar } from './components/TabBar';

export default function App() {
  useDrainQueue();
  const [page, setPage] = useState<Page>(DEFAULT_PAGE);

  return (
    <>
      <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-24 pt-12">
        {page === 'mood' && <Mood />}
        {page === 'calendar' && <Calendar />}
      </main>
      <TabBar active={page} onChange={setPage} />
    </>
  );
}
