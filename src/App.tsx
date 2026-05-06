import Mood from './pages/Mood';
import { useDrainQueue } from './lib/useDrainQueue';

// Day 1: single page. Router added on Day 4 when Calendar lands.
export default function App() {
  useDrainQueue();
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10 pt-12">
      <Mood />
    </main>
  );
}
