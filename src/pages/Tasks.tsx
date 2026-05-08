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
  'THIS_WEEK',
  'NO_DATE',
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

const URGENCY_RANK: Record<TaskCategory, number> = {
  OVERDUE: 0,
  TODAY: 1,
  THIS_WEEK: 2,
  FUTURE: 3,
  NO_DATE: 4,
};

export default function Tasks() {
  const { open, done, loading, error, complete } = useTasks();
  const [showRoutines, setShowRoutines] = useState<boolean>(false);
  const [showFuture, setShowFuture] = useState<boolean>(false);
  const [groupByProject, setGroupByProject] = useState<boolean>(false);

  const visibleOpen = showRoutines ? open : open.filter((t) => !t.is_routine);
  const grouped = groupByCategory(visibleOpen);
  const projectGroups = buildProjectGroups(visibleOpen);
  const doneBuckets = bucketDoneTasks(done);

  const doneRecent = doneBuckets.today.length + doneBuckets.thisWeek.length;
  const meta = `${visibleOpen.length} open · ${doneRecent} done this week`;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Tasks" meta={meta} />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleChip
          label="🔁 Routines"
          active={showRoutines}
          onClick={() => setShowRoutines((v) => !v)}
        />
        <ToggleChip
          label="🗂 By project"
          active={groupByProject}
          onClick={() => setGroupByProject((v) => !v)}
        />
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

      {groupByProject
        ? projectGroups.map((group) => (
            <Section
              key={group.project}
              label={group.project}
              toneClass="text-sky-300"
              tasks={group.tasks}
              hideProject
              onComplete={complete}
            />
          ))
        : SECTION_ORDER.map((cat) => {
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
                onComplete={complete}
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

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95',
        active
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Section({
  label,
  toneClass,
  tasks,
  muted,
  hideProject,
  onComplete,
}: {
  label: string;
  toneClass: string;
  tasks: Task[];
  muted?: boolean;
  hideProject?: boolean;
  onComplete?: (id: string) => void;
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
          <TaskCard
            key={t.id}
            task={t}
            muted={muted}
            hideProject={hideProject}
            onComplete={onComplete}
          />
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

function buildProjectGroups(
  tasks: Task[],
): { project: string; tasks: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.project || 'No project';
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    bucket.push(t);
  }

  for (const items of map.values()) {
    items.sort((a, b) => {
      const ra = URGENCY_RANK[a.category ?? 'NO_DATE'];
      const rb = URGENCY_RANK[b.category ?? 'NO_DATE'];
      if (ra !== rb) return ra - rb;
      const da = a.due ?? '￿';
      const db = b.due ?? '￿';
      return da.localeCompare(db);
    });
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([project, tasks]) => ({ project, tasks }));
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
