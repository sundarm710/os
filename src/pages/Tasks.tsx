import { useEffect, useRef, useState } from 'react';
import { UNCATEGORIZED, type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { kolkataDateString, parseEstMinutes } from '../lib/time';
import { useTasks } from '../lib/useTasks';
import { useIsKeyboardDevice } from '../lib/usePlatform';
import { writeCalendarPrefill } from '../lib/storage';
import { type Page } from '../routes';
import { AddTaskSheet } from '../components/AddTaskSheet';
import { DateSheet } from '../components/DateSheet';
import { PageHeader } from '../components/PageHeader';
import { ProjectSheet } from '../components/ProjectSheet';
import { ProjectsPanel } from '../components/ProjectsPanel';
import { ReplanFlow } from '../components/ReplanFlow';
import { TaskCard } from '../components/TaskCard';
import { TaskOmnibar, type OmnibarHandle } from '../components/TaskOmnibar';
import { KeyboardHelp } from '../components/KeyboardHelp';

const DEFAULT_SCHEDULE_DURATION_MIN = 30;

const REPLAN_CATEGORIES: TaskCategory[] = ['OVERDUE', 'TODAY', 'NO_DATE'];

const SECTION_ORDER: TaskCategory[] = [
  'OVERDUE',
  'TODAY',
  'THIS_WEEK',
  'FUTURE',
  'NO_DATE',
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
  NO_DATE: 'text-slate-400',
  THIS_WEEK: 'text-slate-300',
  FUTURE: 'text-slate-300',
};

// Date sentinel for sorting: NO_DATE tasks land last regardless of position
// in their section. Using a high Unicode code point so localeCompare on
// YYYY-MM-DD strings naturally pushes them after all real dates.
const NO_DUE_SENTINEL = '￿';

function byDueAscending(a: Task, b: Task): number {
  const da = a.due ?? NO_DUE_SENTINEL;
  const db = b.due ?? NO_DUE_SENTINEL;
  return da.localeCompare(db);
}

type TasksProps = { onNavigate: (page: Page) => void };

export default function Tasks({ onNavigate }: TasksProps) {
  const {
    open,
    done,
    projects,
    loading,
    error,
    refresh,
    complete,
    reopen,
    cancel,
    reschedule,
    addTask,
    loadProjects,
    refreshProjects,
    createProject,
    moveToProject,
  } = useTasks();
  const [showRoutines, setShowRoutines] = useState<boolean>(false);
  const [showNoDate, setShowNoDate] = useState<boolean>(false);
  const [groupByProject, setGroupByProject] = useState<boolean>(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [replanQueue, setReplanQueue] = useState<Task[] | null>(null);
  const [managingProjects, setManagingProjects] = useState<boolean>(false);

  const isKeyboard = useIsKeyboardDevice();
  const omnibarRef = useRef<OmnibarHandle>(null);
  // Cursor key: `t:<id>` for a task row, `h:<groupKey>` for a section header.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const collapseGroup = (key: string) =>
    setCollapsed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  // On desktop the omnibar's #project matching needs the project list up
  // front (the FAB normally lazy-loads it on open).
  useEffect(() => {
    if (isKeyboard) void loadProjects();
  }, [isKeyboard, loadProjects]);

  const visibleOpen = showRoutines ? open : open.filter((t) => !t.is_routine);
  const grouped = groupByCategory(visibleOpen);
  const projectGroups = buildProjectGroups(visibleOpen);
  const doneBuckets = bucketDoneTasks(done);
  const reschedulingTask =
    reschedulingId === null
      ? null
      : open.find((t) => t.id === reschedulingId) ?? null;
  const reassigningTask =
    reassigningId === null
      ? null
      : open.find((t) => t.id === reassigningId) ?? null;

  // Opening the project sheet needs the project list, which the FAB otherwise
  // lazy-loads. Fetch on demand so the chips aren't empty on first use.
  function handleReassign(task: Task) {
    void loadProjects();
    setReassigningId(task.id);
  }

  const replanCandidates = visibleOpen.filter((t) =>
    REPLAN_CATEGORIES.includes(t.category ?? 'NO_DATE'),
  );

  const doneRecent = doneBuckets.today.length + doneBuckets.thisWeek.length;
  const meta = `${visibleOpen.length} open · ${doneRecent} done this week`;

  const lastUsedProject =
    open.find((t) => t.project)?.project ?? projects?.[0] ?? null;

  // Open tasks grouped for rendering, in the exact order they appear on screen
  // (NO_DATE stays out until revealed). Both view modes reduce to the same
  // shape so headers and collapse behave identically.
  const openGroups: {
    key: string;
    label: string;
    tone: string;
    tasks: Task[];
  }[] = groupByProject
    ? projectGroups.map((g) => ({
        key: g.project,
        label: g.project,
        tone: 'text-sky-300',
        tasks: g.tasks,
      }))
    : SECTION_ORDER.flatMap((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return [];
        if (cat === 'NO_DATE' && !showNoDate) return [];
        return [
          {
            key: cat as string,
            label: SECTION_LABEL[cat],
            tone: SECTION_TONE[cat],
            tasks: items,
          },
        ];
      });

  // Flat, ordered list of navigable row keys so j/k can land on a section
  // header (`h:<groupKey>`) or a task (`t:<id>`). A collapsed group contributes
  // only its header. Tasks without an id can't be acted on, so they're skipped.
  const navKeys: string[] = openGroups.flatMap((g) => {
    const header = `h:${g.key}`;
    if (collapsed.has(g.key)) return [header];
    return [header, ...g.tasks.filter((t) => t.id).map((t) => `t:${t.id}`)];
  });

  const selectedTaskId =
    selectedKey && selectedKey.startsWith('t:') ? selectedKey.slice(2) : null;

  const groupKeyOfTask = (id: string): string | null =>
    openGroups.find((g) => g.tasks.some((t) => t.id === id))?.key ?? null;

  useEffect(() => {
    if (!isKeyboard) return;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const scrollToKey = (key: string) => {
      const sel = key.startsWith('t:')
        ? `[data-task-id="${CSS.escape(key.slice(2))}"]`
        : `[data-row-key="${CSS.escape(key)}"]`;
      requestAnimationFrame(() => {
        document.querySelector(sel)?.scrollIntoView({ block: 'nearest' });
      });
    };

    const moveSelection = (delta: number) => {
      if (navKeys.length === 0) return;
      const cur = selectedKey ? navKeys.indexOf(selectedKey) : -1;
      const next =
        cur === -1
          ? delta > 0
            ? 0
            : navKeys.length - 1
          : Math.min(navKeys.length - 1, Math.max(0, cur + delta));
      const key = navKeys[next];
      setSelectedKey(key);
      scrollToKey(key);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // These work from anywhere (including while nothing is selected).
      if (!isTyping() && (e.key === 'c' || e.key === '/')) {
        e.preventDefault();
        omnibarRef.current?.focus();
        return;
      }
      if (!isTyping() && e.key === '?') {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (isTyping()) return;

      // A bottom sheet / replan view owns the screen — don't hijack its keys.
      if (adding || reschedulingId !== null || reassigningId !== null || replanQueue) {
        if (e.key === 'Escape') setSelectedKey(null);
        return;
      }

      const headerKey =
        selectedKey && selectedKey.startsWith('h:') ? selectedKey.slice(2) : null;
      const taskId =
        selectedKey && selectedKey.startsWith('t:') ? selectedKey.slice(2) : null;

      // Shift+letter chords (⇧R routines, ⇧P by-project, ⇧C collapse the
      // selected row's group). Keyed off code so layout doesn't matter; other
      // shift combos (⇧digit tab-switch) fall through to App's handler.
      if (e.shiftKey) {
        if (e.code === 'KeyR') {
          e.preventDefault();
          haptic('tap');
          setShowRoutines((v) => !v);
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          haptic('tap');
          setGroupByProject((v) => !v);
        } else if (e.code === 'KeyC') {
          const gk = headerKey ?? (taskId ? groupKeyOfTask(taskId) : null);
          if (gk) {
            e.preventDefault();
            haptic('tap');
            collapseGroup(gk);
            // Land the cursor on the now-collapsed header so ↵ reopens it.
            setSelectedKey(`h:${gk}`);
            scrollToKey(`h:${gk}`);
          }
        }
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          moveSelection(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          moveSelection(-1);
          break;
        case 'Enter':
          if (headerKey) {
            e.preventDefault();
            haptic('tap');
            toggleCollapse(headerKey);
          } else if (taskId) {
            e.preventDefault();
            void complete(taskId);
            setSelectedKey(null);
          }
          break;
        case 'x':
          if (!taskId) break;
          e.preventDefault();
          void complete(taskId);
          setSelectedKey(null);
          break;
        case 'd':
          if (!taskId) break;
          e.preventDefault();
          setReschedulingId(taskId);
          break;
        case 's': {
          const t = taskId ? open.find((x) => x.id === taskId) : null;
          if (!t) break;
          e.preventDefault();
          handleSchedule(t);
          break;
        }
        case 'm': {
          const t = taskId ? open.find((x) => x.id === taskId) : null;
          if (!t) break;
          e.preventDefault();
          handleReassign(t);
          break;
        }
        case 'g':
          e.preventDefault();
          haptic('tap');
          setManagingProjects(true);
          break;
        case 'r':
          if (replanCandidates.length === 0) break;
          e.preventDefault();
          haptic('tap');
          setReplanQueue(replanCandidates);
          break;
        case 'Escape':
          setSelectedKey(null);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isKeyboard,
    navKeys,
    selectedKey,
    openGroups,
    adding,
    reschedulingId,
    reassigningId,
    replanQueue,
    managingProjects,
    replanCandidates,
    open,
    complete,
  ]);

  function handleSchedule(task: Task) {
    // If the task is already scheduled, seed the dial with its current time
    // so re-scheduling is a small tweak rather than a fresh pick. Falls back
    // to task.due → today for unscheduled, and lets Calendar default the time.
    let date = task.due ?? kolkataDateString(new Date());
    let startTime: string | undefined;
    if (task.scheduled_at) {
      const [d, t] = task.scheduled_at.split('T');
      date = d;
      if (t) startTime = t;
    }
    writeCalendarPrefill({
      taskId: task.id,
      title: task.text,
      date,
      durationMin: parseEstMinutes(task.est) ?? DEFAULT_SCHEDULE_DURATION_MIN,
      startTime,
    });
    onNavigate('calendar');
  }

  if (managingProjects) {
    return (
      <ProjectsPanel
        onChanged={() => {
          // Renames and deletes rewrite task attribution server-side, so both
          // the task list and the cached project names have to be re-pulled.
          void refresh();
          void refreshProjects();
        }}
        onExit={() => setManagingProjects(false)}
      />
    );
  }

  if (replanQueue) {
    return (
      <ReplanFlow
        tasks={replanQueue}
        keyboard={isKeyboard}
        onComplete={(id) => void complete(id)}
        onReschedule={(id, date) => void reschedule(id, date)}
        onExit={() => setReplanQueue(null)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Tasks" meta={meta} />

      {isKeyboard && (
        <TaskOmnibar ref={omnibarRef} projects={projects} onAdd={addTask} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {replanCandidates.length > 0 && (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              setReplanQueue(replanCandidates);
            }}
            className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition active:scale-95 hover:border-slate-700 hover:text-slate-100"
          >
            🎯 Replan ({replanCandidates.length})
            {isKeyboard && <KeyHint>r</KeyHint>}
          </button>
        )}
        <ToggleChip
          label="🔁 Routines"
          active={showRoutines}
          hint={isKeyboard ? '⇧R' : undefined}
          onClick={() => setShowRoutines((v) => !v)}
        />
        <ToggleChip
          label="🗂 By project"
          active={groupByProject}
          hint={isKeyboard ? '⇧P' : undefined}
          onClick={() => setGroupByProject((v) => !v)}
        />
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            setManagingProjects(true);
          }}
          className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition active:scale-95 hover:border-slate-700 hover:text-slate-100"
        >
          ⚙ Projects
          {isKeyboard && <KeyHint>g</KeyHint>}
        </button>
        {loading && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Refreshing…
          </span>
        )}
        {isKeyboard && (
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="ml-auto text-[10px] uppercase tracking-wide text-slate-600 transition hover:text-slate-300"
          >
            ⌨ shortcuts (?)
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {openGroups.map((g) => (
        <Section
          key={g.key}
          groupKey={g.key}
          label={g.label}
          toneClass={g.tone}
          tasks={g.tasks}
          hideProject={groupByProject}
          collapsible={isKeyboard}
          collapsed={collapsed.has(g.key)}
          headerSelected={selectedKey === `h:${g.key}`}
          showCollapseHint={isKeyboard}
          selectedTaskId={selectedTaskId}
          onToggleCollapse={() => {
            haptic('tap');
            toggleCollapse(g.key);
          }}
          onComplete={complete}
          onReschedule={setReschedulingId}
          onSchedule={handleSchedule}
          onReassign={handleReassign}
        />
      ))}

      {!groupByProject && !showNoDate && (grouped.NO_DATE?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            setShowNoDate(true);
          }}
          className="self-start rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 transition active:scale-95 hover:border-slate-700 hover:text-slate-200"
        >
          Show {grouped.NO_DATE?.length} undated
        </button>
      )}

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
              onReopen={reopen}
            />
          )}
          {doneBuckets.thisWeek.length > 0 && (
            <Section
              label="This week"
              toneClass="text-slate-400"
              tasks={doneBuckets.thisWeek}
              muted
              onReopen={reopen}
            />
          )}
          {doneBuckets.earlier.length > 0 && (
            <Section
              label="Earlier"
              toneClass="text-slate-500"
              tasks={doneBuckets.earlier}
              muted
              onReopen={reopen}
            />
          )}
        </div>
      )}

      <DateSheet
        open={reschedulingTask !== null}
        taskTitle={reschedulingTask?.text}
        currentDue={reschedulingTask?.due ?? null}
        onClose={() => setReschedulingId(null)}
        onPick={(date) => {
          if (reschedulingId) void reschedule(reschedulingId, date);
          setReschedulingId(null);
        }}
        onCancel={() => {
          if (reschedulingId) void cancel(reschedulingId);
          setReschedulingId(null);
        }}
      />

      <ProjectSheet
        open={reassigningTask !== null}
        taskTitle={reassigningTask?.text}
        currentProject={reassigningTask?.project ?? null}
        projects={projects}
        onClose={() => setReassigningId(null)}
        onPick={(project) => {
          if (reassigningId) void moveToProject(reassigningId, project);
          setReassigningId(null);
        }}
        onCreate={createProject}
      />

      <AddTaskSheet
        open={adding}
        projects={projects}
        defaultProject={lastUsedProject}
        onClose={() => setAdding(false)}
        onAdd={addTask}
        onCreateProject={createProject}
      />

      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />

      <button
        type="button"
        aria-label="Add task"
        onClick={() => {
          haptic('tap');
          void loadProjects();
          setAdding(true);
        }}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light leading-none text-emerald-50 shadow-xl shadow-emerald-500/30 transition active:scale-90 hover:bg-emerald-400"
      >
        +
      </button>
    </section>
  );
}

function ToggleChip({
  label,
  active,
  hint,
  onClick,
}: {
  label: string;
  active: boolean;
  hint?: string;
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
      {hint && <KeyHint>{hint}</KeyHint>}
    </button>
  );
}

// Faint monospace key badge appended to a chip so the shortcut is discoverable.
function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded border border-current px-1 font-mono text-[10px] opacity-50">
      {children}
    </span>
  );
}

function Section({
  label,
  toneClass,
  tasks,
  muted,
  hideProject,
  groupKey,
  collapsible,
  collapsed,
  headerSelected,
  showCollapseHint,
  selectedTaskId,
  onToggleCollapse,
  onComplete,
  onReopen,
  onReschedule,
  onSchedule,
  onReassign,
}: {
  label: string;
  toneClass: string;
  tasks: Task[];
  muted?: boolean;
  hideProject?: boolean;
  groupKey?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  headerSelected?: boolean;
  showCollapseHint?: boolean;
  selectedTaskId?: string | null;
  onToggleCollapse?: () => void;
  onComplete?: (id: string | null) => void;
  onReopen?: (id: string | null) => void;
  onReschedule?: (id: string | null) => void;
  onSchedule?: (task: Task) => void;
  onReassign?: (task: Task) => void;
}) {
  const count = (
    <span className="text-[10px] uppercase tracking-wide text-slate-500">
      {tasks.length}
    </span>
  );
  const labelClass = `text-xs font-semibold uppercase tracking-wide ${
    headerSelected ? 'text-emerald-200' : toneClass
  }`;

  return (
    <div className="flex flex-col gap-2">
      {collapsible && onToggleCollapse ? (
        <button
          type="button"
          data-row-key={groupKey ? `h:${groupKey}` : undefined}
          onClick={onToggleCollapse}
          className={[
            'flex items-baseline justify-between rounded-md px-1 py-0.5 -mx-1 text-left transition',
            headerSelected
              ? 'bg-emerald-400/10 ring-1 ring-emerald-400/50'
              : 'hover:bg-slate-900',
          ].join(' ')}
        >
          <span className={labelClass}>
            <span className="mr-1 inline-block text-slate-500">
              {collapsed ? '▸' : '▾'}
            </span>
            {label}
            {showCollapseHint && !collapsed && <KeyHint>⇧C</KeyHint>}
          </span>
          {count}
        </button>
      ) : (
        <div className="flex items-baseline justify-between">
          <span className={labelClass}>{label}</span>
          {count}
        </div>
      )}

      {!collapsed && (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              muted={muted}
              hideProject={hideProject}
              selected={selectedTaskId != null && t.id === selectedTaskId}
              onComplete={onComplete}
              onReopen={onReopen}
              onReschedule={onReschedule}
              onSchedule={onSchedule}
              onReassign={onReassign}
            />
          ))}
        </ul>
      )}
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
  for (const items of Object.values(out)) {
    if (items) items.sort(byDueAscending);
  }
  return out;
}

function buildProjectGroups(
  tasks: Task[],
): { project: string; tasks: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    // The server now attributes every task, so this fallback is belt-and-braces
    // for an older payload — it names the same catch-all the backend uses.
    const key = t.project || UNCATEGORIZED;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    bucket.push(t);
  }

  for (const items of map.values()) {
    items.sort(byDueAscending);
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
