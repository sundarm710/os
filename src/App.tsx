import { useState } from 'react';
import { useDrainQueue } from './lib/useDrainQueue';
import { DEFAULT_PAGE, type Page } from './routes';
import Tasks from './pages/Tasks';
import Journal from './pages/Journal';
import Calendar from './pages/Calendar';
import Workouts from './pages/Workouts';
import { TabBar } from './components/TabBar';

export default function App() {
  useDrainQueue();
  const [page, setPage] = useState<Page>(DEFAULT_PAGE);

  return (
    <>
      <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-24 pt-12">
        {page === 'tasks' && <Tasks />}
        {page === 'journal' && <Journal />}
        {page === 'calendar' && <Calendar />}
        {page === 'workouts' && <Workouts />}
      </main>
      <TabBar active={page} onChange={setPage} />
    </>
  );
}
