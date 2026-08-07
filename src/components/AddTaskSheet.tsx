import { useEffect, useState } from 'react';
import { type AddTaskParams } from '../lib/useTasks';
import { haptic } from '../lib/haptic';
import { kolkataDateString, shiftKolkataDate } from '../lib/time';

interface Props {
  open: boolean;
  projects: string[] | null;
  defaultProject?: string | null;
  onClose: () => void;
  onAdd: (params: AddTaskParams) => Promise<void>;
  /** Create a project note before the add; resolves to its canonical name. */
  onCreateProject: (name: string) => Promise<string>;
}

export function AddTaskSheet({
  open,
  projects,
  defaultProject,
  onClose,
  onAdd,
  onCreateProject,
}: Props) {
  const [text, setText] = useState<string>('');
  const [project, setProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<string>('');
  const [showNewProject, setShowNewProject] = useState<boolean>(false);
  const [due, setDue] = useState<string | null>(null);
  const [recur, setRecur] = useState<string | null>(null);
  const [est, setEst] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the sheet opens so a stale draft doesn't leak.
  useEffect(() => {
    if (open) {
      setText('');
      setProject(defaultProject ?? null);
      setNewProject('');
      setShowNewProject(false);
      setDue(null);
      setRecur(null);
      setEst('');
      setSubmitting(false);
      setCreatingProject(false);
      setError(null);
    }
  }, [open, defaultProject]);

  if (!open) return null;

  const finalProject = showNewProject ? newProject.trim() : project;
  const trimmedText = text.trim();
  const canSubmit = !submitting && trimmedText.length > 0;

  const now = new Date();
  const today = kolkataDateString(now);
  const tomorrow = shiftKolkataDate(now, 1);
  const oneWeek = shiftKolkataDate(now, 7);

  // Create the typed project as its own step. Creating a project is a real
  // action with its own outcome, so it gets its own button rather than riding
  // along on the task submit — otherwise there's nothing to press when you only
  // want the project, since `canSubmit` requires task text.
  async function handleCreateProject() {
    const name = newProject.trim();
    if (!name || creatingProject) return;
    setCreatingProject(true);
    setError(null);
    haptic('submitStart');
    try {
      const created = await onCreateProject(name);
      haptic('successRamp');
      // Collapse back to the chip row with the new project pre-selected, so it
      // reads the same as picking an existing one.
      setProject(created);
      setShowNewProject(false);
      setNewProject('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    haptic('submitStart');
    try {
      // Fallback for typing a name and hitting "Add task" without pressing
      // Create — the project note has to exist before the add, or the server
      // bounces it with "Project not found".
      let resolvedProject = finalProject;
      if (showNewProject && resolvedProject) {
        resolvedProject = await onCreateProject(resolvedProject);
      }
      await onAdd({
        text: trimmedText,
        ...(resolvedProject ? { project: resolvedProject } : {}),
        ...(due !== null ? { due } : {}),
        ...(est.trim() ? { est: est.trim() } : {}),
        ...(recur ? { recur } : {}),
      });
      haptic('successRamp');
      onClose();
    } catch (e) {
      // Surface it here: useTasks re-throws creation failures without setting
      // the page banner, so the sheet is the only place this can be seen.
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="New task"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">New task</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
          }}
          placeholder="What needs doing?"
          maxLength={280}
          enterKeyHint="send"
          autoCapitalize="sentences"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Project
          </span>
          {showNewProject ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => {
                  // Enter here creates the project — it must not fall through
                  // to the task submit, which would be disabled anyway.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreateProject();
                  }
                }}
                placeholder="New project name"
                maxLength={60}
                enterKeyHint="done"
                autoFocus
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="button"
                disabled={creatingProject || !newProject.trim()}
                onClick={() => void handleCreateProject()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-50 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {creatingProject ? '…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewProject(false);
                  setNewProject('');
                  setError(null);
                }}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(projects ?? []).map((p) => (
                <SmallChip
                  key={p}
                  label={p}
                  active={project === p}
                  onClick={() => {
                    haptic('tap');
                    setProject(project === p ? null : p);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  haptic('tap');
                  setShowNewProject(true);
                }}
                className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 transition active:scale-95 hover:border-emerald-500 hover:text-emerald-200"
              >
                + New
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Due (optional)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SmallChip
              label="Today"
              active={due === today}
              onClick={() => {
                haptic('tap');
                setDue(due === today ? null : today);
              }}
            />
            <SmallChip
              label="Tomorrow"
              active={due === tomorrow}
              onClick={() => {
                haptic('tap');
                setDue(due === tomorrow ? null : tomorrow);
              }}
            />
            <SmallChip
              label="+1 week"
              active={due === oneWeek}
              onClick={() => {
                haptic('tap');
                setDue(due === oneWeek ? null : oneWeek);
              }}
            />
            <input
              type="date"
              value={due && due !== today && due !== tomorrow && due !== oneWeek ? due : ''}
              onChange={(e) => setDue(e.target.value || null)}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Repeat
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Daily', value: 'every day' },
              { label: 'Weekly', value: 'every week' },
              { label: 'Fortnightly', value: 'every 2 weeks' },
              (() => {
                const monthDay = due
                  ? parseInt(due.split('-')[2], 10)
                  : parseInt(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', day: 'numeric' }), 10);
                const ord = ordinal(monthDay);
                return { label: `Monthly (${ord})`, value: `every month on the ${ord}` };
              })(),
            ].map(({ label, value }) => (
              <SmallChip
                key={value}
                label={label}
                active={recur === value}
                onClick={() => {
                  haptic('tap');
                  setRecur(recur === value ? null : value);
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Estimate (optional)
          </span>
          <input
            type="text"
            value={est}
            onChange={(e) => setEst(e.target.value)}
            placeholder="30m, 1h, …"
            maxLength={20}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-emerald-50 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          {submitting ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function SmallChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition active:scale-95',
        active
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
