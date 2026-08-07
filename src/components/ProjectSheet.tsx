import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';

interface Props {
  open: boolean;
  /** Title of the task being reassigned — shown as context. */
  taskTitle?: string;
  /** The task's current project, rendered as the active chip. */
  currentProject?: string | null;
  projects: string[] | null;
  onClose: () => void;
  /** Reassign to an existing project. */
  onPick: (project: string) => void;
  /** Create a new project note, then reassign to it. Resolves to the name. */
  onCreate: (name: string) => Promise<string>;
}

/**
 * Bottom sheet for moving a task between projects. Doubles as the "new
 * project" entry point — creating one here files the task into it in the same
 * gesture, so the user never has to open the vault to add a project.
 */
export function ProjectSheet({
  open,
  taskTitle,
  currentProject,
  projects,
  onClose,
  onPick,
  onCreate,
}: Props) {
  const [filter, setFilter] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Reset per-open so a cancelled draft doesn't reappear on the next task.
  useEffect(() => {
    if (open) {
      setFilter('');
      setCreating(false);
      setNewName('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  if (!open) return null;

  const q = filter.trim().toLowerCase();
  const visible = (projects ?? []).filter(
    (p) => !q || p.toLowerCase().includes(q),
  );

  async function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    haptic('submitStart');
    try {
      const created = await onCreate(name);
      haptic('successRamp');
      onPick(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
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
        aria-label="Move to project"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">Move to project</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        {taskTitle && (
          <p className="mb-4 truncate text-xs text-slate-500">{taskTitle}</p>
        )}

        {error && (
          <p className="mb-3 rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        {creating ? (
          <div className="flex gap-2">
            <input
              ref={newInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="New project name"
              maxLength={60}
              enterKeyHint="done"
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-50 transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {busy ? '…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {(projects?.length ?? 0) > 6 && (
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter projects…"
                className="mb-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {visible.map((p) => {
                const isCurrent = p === currentProject;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      haptic('tap');
                      onPick(p);
                      onClose();
                    }}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm transition active:scale-95',
                      isCurrent
                        ? 'cursor-default border-emerald-400 bg-emerald-400/10 text-emerald-200'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  haptic('tap');
                  setNewName(filter.trim());
                  setCreating(true);
                }}
                className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 transition active:scale-95 hover:border-emerald-500 hover:text-emerald-200"
              >
                + New project
              </button>
            </div>
            {projects !== null && visible.length === 0 && q && (
              <p className="mt-3 text-xs text-slate-500">
                No project matches “{filter.trim()}”.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
