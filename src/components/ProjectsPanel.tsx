import { useEffect, useRef, useState } from 'react';
import { UNCATEGORIZED, type ProjectStat } from '../lib/api';
import { haptic } from '../lib/haptic';
import { useProjects } from '../lib/useProjects';

interface Props {
  /** Resync the task list — project labels go stale on rename/delete. */
  onChanged: () => void;
  onExit: () => void;
}

/**
 * Linear-style project manager: one row per project with its task counts, and
 * inline create / rename / delete. Renders as a full-page takeover (same shape
 * as ReplanFlow) rather than a sheet, since it's a management surface rather
 * than a quick action.
 */
export function ProjectsPanel({ onChanged, onExit }: Props) {
  const { stats, loading, error, busyProject, create, rename, remove } =
    useProjects(onChanged);

  const [adding, setAdding] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape unwinds one layer at a time: editor → panel.
      if (adding || renamingKey || confirmDelete) {
        setAdding(false);
        setRenamingKey(null);
        setConfirmDelete(null);
      } else {
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, renamingKey, confirmDelete, onExit]);

  async function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    haptic('submitStart');
    if (await create(name)) {
      haptic('successRamp');
      setNewName('');
      setAdding(false);
    }
  }

  async function submitRename(from: string) {
    const to = renameValue.trim();
    if (!to || to === from) {
      setRenamingKey(null);
      return;
    }
    haptic('submitStart');
    if (await rename(from, to)) {
      haptic('successRamp');
      setRenamingKey(null);
    }
  }

  async function submitDelete(name: string) {
    haptic('submitStart');
    if (await remove(name)) {
      haptic('successRamp');
      setConfirmDelete(null);
    }
  }

  const total = stats?.reduce((n, p) => n + p.open + p.in_progress, 0) ?? 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Projects</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {stats ? `${stats.length} projects · ${total} open` : 'Loading…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            onExit();
          }}
          className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700 hover:text-slate-100"
        >
          ← Tasks
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {adding ? (
        <div className="flex gap-2">
          <input
            ref={addRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitCreate();
              }
            }}
            placeholder="New project name"
            maxLength={60}
            enterKeyHint="done"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <button
            type="button"
            disabled={!newName.trim() || busyProject !== null}
            onClick={() => void submitCreate()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-50 transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-500"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName('');
            }}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            setAdding(true);
          }}
          className="self-start rounded-full border border-dashed border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 transition active:scale-95 hover:border-emerald-500 hover:text-emerald-200"
        >
          + New project
        </button>
      )}

      {loading && !stats && (
        <p className="text-xs text-slate-500">Loading projects…</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {(stats ?? []).map((p) => (
          <ProjectRow
            key={p.name}
            project={p}
            busy={busyProject === p.name}
            renaming={renamingKey === p.name}
            renameValue={renameValue}
            confirming={confirmDelete === p.name}
            onRenameStart={() => {
              haptic('tap');
              setConfirmDelete(null);
              setRenamingKey(p.name);
              setRenameValue(p.name);
            }}
            onRenameChange={setRenameValue}
            onRenameSubmit={() => void submitRename(p.name)}
            onRenameCancel={() => setRenamingKey(null)}
            onDeleteStart={() => {
              haptic('tap');
              setRenamingKey(null);
              setConfirmDelete(p.name);
            }}
            onDeleteConfirm={() => void submitDelete(p.name)}
            onDeleteCancel={() => setConfirmDelete(null)}
          />
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-slate-600">
        Deleting a project moves its tasks to {UNCATEGORIZED} and archives the
        note to <code className="text-slate-500">450 Projects/_archive/</code> —
        nothing is destroyed. Tasks added without a project also land in{' '}
        {UNCATEGORIZED}.
      </p>
    </section>
  );
}

function ProjectRow({
  project,
  busy,
  renaming,
  renameValue,
  confirming,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  project: ProjectStat;
  busy: boolean;
  renaming: boolean;
  renameValue: string;
  confirming: boolean;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDeleteStart: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const active = project.open + project.in_progress;

  if (renaming) {
    return (
      <li className="rounded-lg border border-emerald-700/60 bg-slate-900/60 px-3 py-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRenameSubmit();
              }
            }}
            maxLength={60}
            enterKeyHint="done"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !renameValue.trim()}
            onClick={onRenameSubmit}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {busy ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onRenameCancel}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  if (confirming) {
    return (
      <li className="rounded-lg border border-rose-700/60 bg-rose-900/10 px-3 py-2">
        <p className="text-xs text-rose-200">
          Delete <span className="font-semibold">{project.name}</span>?
          {active > 0
            ? ` Its ${active} open task${active === 1 ? '' : 's'} move to ${UNCATEGORIZED}.`
            : ' It has no open tasks.'}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteConfirm}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-rose-50 transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onDeleteCancel}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition active:scale-95 hover:border-slate-700"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">
          {project.name}
          {project.is_default && (
            <span className="ml-2 rounded-full border border-slate-700 px-1.5 py-0 text-[10px] uppercase tracking-wide text-slate-500">
              default
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {active} open
          {project.in_progress > 0 && ` · ${project.in_progress} in progress`}
          {project.done > 0 && ` · ${project.done} done (30d)`}
        </p>
      </div>

      {/* The catch-all has no rename/delete — every orphaned task depends on it. */}
      {!project.is_default && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onRenameStart}
            aria-label={`Rename ${project.name}`}
            className="rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-400 transition active:scale-95 hover:border-emerald-500 hover:text-emerald-200"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={onDeleteStart}
            aria-label={`Delete ${project.name}`}
            className="rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-400 transition active:scale-95 hover:border-rose-500 hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
