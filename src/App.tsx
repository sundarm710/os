import Mood from './pages/Mood';

// Day 1: single page. Router added on Day 4 when Calendar lands.
export default function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10 pt-12">
      <Mood />
    </main>
  );
}
