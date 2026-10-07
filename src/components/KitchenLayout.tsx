import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';
import { addPlace, deletePlace, movePlace, moveTargets, renamePlace, type Place } from '../lib/home';

interface Props {
  places: Place[] | null;
  /** Re-pull places after every change so the Kitchen page reflects it. */
  reload: () => Promise<void>;
  onDone: () => void;
}

type Mode = 'menu' | 'rename' | 'add' | 'move' | 'delete';

// Kitchen settings: the master layout. Every place (room › cupboard › shelf ›
// box) can be renamed, given children, moved or deleted. Items are never
// touched here — moving a shelf takes everything on it along.
export function KitchenLayout({ places, reload, onDone }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [text, setText] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = places?.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (mode === 'rename' || mode === 'add') inputRef.current?.focus();
  }, [mode]);

  function select(p: Place) {
    haptic('tap');
    setError(null);
    setMode('menu');
    setSelectedId(selectedId === p.id ? null : p.id);
  }

  function open(next: Mode) {
    if (!selected) return;
    haptic('tap');
    setError(null);
    setText(next === 'rename' ? lastPart(selected.path) : '');
    setMode(next);
  }

  async function run(action: () => Promise<void>, keepId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      haptic('successRamp');
      setMode('menu');
      setSelectedId(keepId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function submitText() {
    if (!selected || !text.trim() || busy) return;
    if (mode === 'rename') void run(() => renamePlace(selected.id, text.trim()), selected.id);
    if (mode === 'add') void run(() => addPlace(selected, text.trim()), selected.id);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">⚙️ Kitchen layout</h1>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-200 transition active:scale-95"
        >
          Done
        </button>
      </div>
      <p className="-mt-3 text-sm text-slate-500">
        Tap a spot to rename it, add shelves or boxes inside, move it, or delete it. Moving a spot takes everything on it
        along.
      </p>

      {!places && <p className="text-sm text-slate-500">Loading…</p>}

      {places && (
        <ul className="flex flex-col gap-1">
          {places.map((p) => {
            const depth = p.path.split(' › ').length - 1;
            const isSel = p.id === selectedId;
            const isRoot = depth === 0;
            return (
              <li key={p.id} style={{ paddingLeft: `${depth * 1.25}rem` }}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  className={`flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left transition ${
                    isSel ? 'bg-emerald-500/10 text-emerald-200' : isRoot ? 'font-semibold text-slate-100' : 'text-slate-300'
                  }`}
                >
                  <span>
                    {p.kind === 'container' ? '📦 ' : ''}
                    {lastPart(p.path)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-600">
                    {p.items > 0 ? `${p.items} items · ` : ''}L{depth}
                  </span>
                </button>

                {isSel && (
                  <div className="mb-2 mt-1 flex flex-col gap-2 px-3">
                    {mode === 'menu' && (
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Pill onClick={() => open('rename')}>✎ Rename</Pill>
                        <Pill onClick={() => open('add')}>＋ Add inside</Pill>
                        {!isRoot && <Pill onClick={() => open('move')}>↗ Move</Pill>}
                        {!isRoot && (
                          <Pill tone="rose" onClick={() => open('delete')}>
                            🗑 Delete
                          </Pill>
                        )}
                      </div>
                    )}

                    {(mode === 'rename' || mode === 'add') && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitText();
                        }}
                        className="flex gap-2"
                      >
                        <input
                          ref={inputRef}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setMode('menu')}
                          placeholder={mode === 'add' ? `New spot inside ${lastPart(p.path)} — e.g. Shelf 1` : 'Name'}
                          disabled={busy}
                          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={busy || !text.trim()}
                          className="rounded-lg bg-emerald-500 px-4 text-sm font-medium text-emerald-50 transition active:scale-95 disabled:opacity-50"
                        >
                          {busy ? '…' : mode === 'add' ? 'Add' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setMode('menu')} className="px-1 text-sm text-slate-500">
                          ✕
                        </button>
                      </form>
                    )}

                    {mode === 'move' && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                        <div className="flex items-center justify-between px-1 pb-1">
                          <span className="text-xs text-slate-500">Move {lastPart(p.path)} into…</span>
                          <button type="button" onClick={() => setMode('menu')} className="text-sm text-slate-500">
                            ✕
                          </button>
                        </div>
                        <ul className="max-h-64 overflow-y-auto">
                          {moveTargets(places, p).map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void run(() => movePlace(p.id, t.id), p.id)}
                                className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-300 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
                              >
                                {t.path.split(' › ').slice(1).join(' › ') || t.path}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {mode === 'delete' && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-rose-200">Delete {lastPart(p.path)}?</span>
                        <Pill tone="rose" onClick={() => void run(() => deletePlace(p.id), null)} disabled={busy}>
                          {busy ? '…' : 'Yes, delete'}
                        </Pill>
                        <Pill onClick={() => setMode('menu')}>Cancel</Pill>
                      </div>
                    )}

                    {error && <p className="text-sm text-rose-300">{error}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function lastPart(path: string): string {
  const parts = path.split(' › ');
  return parts[parts.length - 1];
}

function Pill({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'rose';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 transition active:scale-95 disabled:opacity-50 ${
        tone === 'rose'
          ? 'border-rose-900/70 bg-slate-900 text-rose-300 hover:border-rose-700'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
