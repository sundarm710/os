import { useState } from 'react';
import { useDrainQueue } from './lib/useDrainQueue';
import { DEFAULT_PAGE, type Page } from './routes';
import Tasks from './pages/Tasks';
import Journal from './pages/Journal';
import DailyNote from './pages/DailyNote';
import Calendar from './pages/Calendar';
import Workouts from './pages/Workouts';
import Learn from './pages/Learn';
import People from './pages/People';
import Notes from './pages/Notes';
import { TabBar } from './components/TabBar';

export default function App() {
  useDrainQueue();
  const [page, setPage] = useState<Page>(DEFAULT_PAGE);

  return (
    <>
      <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-24 pt-12">
        {page === 'tasks' && <Tasks onNavigate={setPage} />}
        {page === 'journal' && <Journal />}
        {page === 'daily-note' && <DailyNote />}
        {page === 'calendar' && <Calendar />}
        {page === 'workouts' && <Workouts />}
        {page === 'learn' && <Learn />}
        {page === 'people' && <People />}
        {page === 'notes' && <Notes />}
      </main>
      <TabBar active={page} onChange={setPage} />
    </>
  );
}
