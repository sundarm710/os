import { useState } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { kolkataDateString } from '../lib/time';
import { useTasks } from '../lib/useTasks';
import { PageHeader } from '../components/PageHeader';
import { TaskCard } from '../components/TaskCard';

const SECTION_ORDER: TaskCategory[] = [
  'OVERDUE',
  'TODAY',
  'NO_DATE',
  'THIS_WEEK',
  'FUTURE',
];

const SECTION_LABEL: Record<TaskCategory, string> = {
  OVERDUE: 'Overdue',
  TODAY: 'Today',
  NO_DATE: 'No date',
  THIS_WEEK: 'This week',
  FUTURE: 'Later',
};

const SECTION_TONE: Record<TaskCategory, string> = {
  OVERDUE: 'text-rose-300',
  TODAY: 'text-emerald-300',
  NO_DATE: 'text-slate-300',
  THIS_WEEK: 'text-slate-300',
  FUTURE: 'text-slate-400',
};

export default function Tasks() {
  const { open, done, loading, error } = useTasks();
  const [showRoutines, setShowRoutines] = useState<boolean>(false);
  const [showFuture, setShowFuture] = useState<boolean>(false);

  const visibleOpen = showRoutines ? open : open.filter((t) => !t.is_routine);
  const grouped = groupByCategory(visibleOpen);
  const doneBuckets = bucketDoneTasks(done);

  const doneRecent = doneBuckets.today.length + doneBuckets.thisWeek.length;
  const meta = `${visibleOpen.length} open · ${doneRecent} done this week`;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Tasks" meta={meta} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={showRoutines}
          onClick={() => {
            haptic('tap');
            setShowRoutines((v) => !v);
          }}
          className={[
            'rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95',
            showRoutines
              ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
              : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
          ].join(' ')}
        >
          🔁 Routines
        </button>
        {loading && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Refreshing…
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {SECTION_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        if (cat === 'FUTURE' && !showFuture) {
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                haptic('tap');
                setShowFuture(true);
              }}
              className="self-start rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 transition active:scale-95 hover:border-slate-700 hover:text-slate-200"
            >
              Show {items.length} later
            </button>
          );
        }
        return (
          <Section
            key={cat}
            label={SECTION_LABEL[cat]}
            toneClass={SECTION_TONE[cat]}
            tasks={items}
          />
        );
      })}

      {!loading && !error && open.length === 0 && <EmptyAllClear />}

      {!loading && !error && open.length > 0 && visibleOpen.length === 0 && (
        <p className="text-xs text-slate-500">
          Only routines remain — toggle the chip above to see them.
        </p>
      )}

      {doneRecent + doneBuckets.earlier.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Completed
          </span>
          {doneBuckets.today.length > 0 && (
            <Section
              label="Today"
              toneClass="text-slate-400"
              tasks={doneBuckets.today}
              muted
            />
          )}
          {doneBuckets.thisWeek.length > 0 && (
            <Section
              label="This week"
              toneClass="text-slate-400"
              tasks={doneBuckets.thisWeek}
              muted
            />
          )}
          {doneBuckets.earlier.length > 0 && (
            <Section
              label="Earlier"
              toneClass="text-slate-500"
              tasks={doneBuckets.earlier}
              muted
            />
          )}
        </div>
      )}
    </section>
  );
}

function Section({
  label,
  toneClass,
  tasks,
  muted,
}: {
  label: string;
  toneClass: string;
  tasks: Task[];
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}
        >
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {tasks.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} muted={muted} />
        ))}
      </ul>
    </div>
  );
}

function EmptyAllClear() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-6 py-8 text-center">
      <p className="text-sm font-medium text-slate-200">All clear ✓</p>
      <p className="mt-1 text-xs text-slate-500">Nothing open right now.</p>
    </div>
  );
}

function groupByCategory(tasks: Task[]): Partial<Record<TaskCategory, Task[]>> {
  const out: Partial<Record<TaskCategory, Task[]>> = {};
  for (const t of tasks) {
    const cat = t.category ?? 'NO_DATE';
    (out[cat] ??= []).push(t);
  }
  return out;
}

function bucketDoneTasks(done: Task[]): {
  today: Task[];
  thisWeek: Task[];
  earlier: Task[];
} {
  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const earlier: Task[] = [];

  const now = new Date();
  const todayKey = kolkataDateString(now);
  const sevenDaysAgoKey = kolkataDateString(
    new Date(now.getTime() - 7 * 86_400_000),
  );

  // Newest-first within each bucket.
  const sorted = [...done].sort((a, b) => {
    const ka = a.completed ?? '';
    const kb = b.completed ?? '';
    return kb.localeCompare(ka);
  });

  for (const t of sorted) {
    if (!t.completed) continue;
    if (t.completed === todayKey) today.push(t);
    else if (t.completed >= sevenDaysAgoKey) thisWeek.push(t);
    else earlier.push(t);
  }
  return { today, thisWeek, earlier };
}
