import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';
import {
  addAlias,
  addItem,
  addPlace,
  expiryLabel,
  FILTERS,
  matchesFilter,
  nodePaths,
  renamePlace,
  setExpiry,
  type Filter,
  LEVEL_STYLE,
  LEVELS,
  setLevel,
  setType,
  stockLevel,
  TYPE_OPTIONS,
  type Category,
  type Level,
  childKind,
  childrenByParent,
  fetchNodes,
  loadPhotoDraft,
  movePlace,
  moveTargetsFor,
  placesFromNodes,
  type HomeNode,
  type Place,
} from '../lib/home';
import { useLongPress } from '../lib/useLongPress';
import { PhotoInventoryFlow, type PhotoStart } from '../components/PhotoInventoryFlow';
import { KitchenLayout } from '../components/KitchenLayout';

// Kitchen tab: collapsible tree of places and what is in them, photo onboarding per place, long-press to move.
// The visual kitchen map and due list come next (see 960 Agents/so-home).
export default function Kitchen() {
  const [nodes, setNodes] = useState<HomeNode[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState<HomeNode | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const seeded = useRef(false);
  // Today in Asia/Kolkata — the browser may be anywhere, the kitchen is not.
  const today = useMemo(() => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10), []);
  const paths = useMemo(() => nodePaths(nodes ?? []), [nodes]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, (nodes ?? []).filter((n) => matchesFilter(n, f.id, today)).length])),
    [nodes, today],
  );
  const places = useMemo(() => (nodes ? placesFromNodes(nodes) : null), [nodes]);
  const kids = useMemo(() => childrenByParent(nodes ?? []), [nodes]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [note, setNote] = useState<string>('');
  const [flow, setFlow] = useState<PhotoStart | 'resume' | null>(null);
  const [settings, setSettings] = useState<boolean>(false);
  const [draftCount, setDraftCount] = useState<number>(() => loadPhotoDraft()?.cards.length ?? 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const ns = await fetchNodes();
      setNodes(ns);
      if (!seeded.current) {
        // First open: level one (Left / Right) is expanded so their areas show; everything deeper stays closed.
        seeded.current = true;
        const roots = new Set(ns.filter((n) => !n.parent_id).map((n) => n.id));
        setOpen(new Set(ns.filter((n) => n.parent_id && roots.has(n.parent_id)).map((n) => n.id)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function finish(action: () => Promise<void>) {
    await action();
    await load();
    haptic('successRamp');
    setMoving(null);
  }

  if (settings) {
    return (
      <KitchenLayout
        places={places}
        reload={load}
        onDone={() => {
          // A renamed/moved/deleted spot may be the one selected here.
          setSelected(null);
          setSettings(false);
        }}
      />
    );
  }

  if (flow) {
    return (
      <PhotoInventoryFlow
        start={flow === 'resume' ? undefined : flow}
        onCommitted={() => void load()}
        onExit={() => {
          setFlow(null);
          setNote('');
          setDraftCount(loadPhotoDraft()?.cards.length ?? 0);
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">🍳 Kitchen</h1>
          <p className="mt-1 text-sm text-slate-500">Tap ▸ to open a spot, 📷 to photograph it. Long-press anything to rename, add inside, move or set its level.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            setSettings(true);
          }}
          aria-label="Kitchen layout settings"
          className="shrink-0 rounded-full border border-slate-800 bg-slate-900 p-2 text-xl leading-none transition active:scale-95 hover:border-slate-600"
        >
          ⚙️
        </button>
      </div>

      {draftCount > 0 && (
        <button
          type="button"
          onClick={() => setFlow('resume')}
          className="rounded-xl border border-amber-800/70 bg-amber-500/10 py-3 text-base font-medium text-amber-200 transition active:scale-95"
        >
          📷 Resume photo review ({draftCount})
        </button>
      )}

      {error && (
        <p className="text-sm text-rose-300">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="underline">
            Retry
          </button>
        </p>
      )}
      {!nodes && !error && <p className="text-sm text-slate-500">Loading places…</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && selected) {
            // The text box is an alternative name for this spot only — saved on it, not sent to the photo agent.
            const alias = note.trim();
            if (alias) void addAlias(selected.id, alias).then(() => load()).catch(() => undefined);
            setFlow({ file, place: selected, note: '' });
          }
        }}
      />

      {nodes && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            const tone =
              f.id === 'empty'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                : f.id === 'low'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-orange-500/40 bg-orange-500/15 text-orange-200';
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  haptic('tap');
                  setFilter(on ? null : f.id);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${
                  on ? tone : counts[f.id] ? 'border-slate-700 text-slate-300' : 'border-slate-800 text-slate-600'
                }`}
              >
                {f.label} · {counts[f.id]}
              </button>
            );
          })}
        </div>
      )}

      {nodes && filter && (
        <ul className="flex flex-col">
          {nodes
            .filter((n) => matchesFilter(n, filter, today))
            .sort((a, b) => (paths.get(a.id) ?? '').localeCompare(paths.get(b.id) ?? ''))
            .map((n) => (
              <FilterRow key={n.id} node={n} path={paths.get(n.id) ?? ''} today={today} onOpen={() => setMoving(n)} />
            ))}
          {counts[filter] === 0 && <li className="px-2 py-3 text-sm text-slate-500">Nothing here — all good.</li>}
        </ul>
      )}

      {nodes && !filter && (
        <ul className="flex flex-col">
          {(kids.get('') ?? []).flatMap((root) => (kids.get(root.id) ?? []).map((n) => (
            <Branch
              key={n.id}
              node={n}
              depth={0}
              kids={kids}
              open={open}
              toggle={(id) =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(id)) next.add(id);
                  return next;
                })
              }
              selectedId={selected?.id ?? null}
              select={(n) => {
                const p = places?.find((x) => x.id === n.id) ?? null;
                setSelected(selected?.id === n.id ? null : p);
              }}
              onMove={(n) => {
                haptic('tap');
                setMoving(n);
              }}
              note={note}
              setNote={setNote}
              reload={load}
              today={today}
              pickPhoto={() => fileRef.current?.click()}
            />
          )))}
        </ul>
      )}

      {moving && nodes && (
        <ActionSheet
          node={moving}
          targets={moveTargetsFor(nodes, moving)}
          place={places?.find((p) => p.id === moving.id) ?? null}
          onClose={() => setMoving(null)}
          ops={{
            level: (l) => finish(() => setLevel(moving.id, l)),
            type: (t) => finish(() => setType(moving.id, t)),
            move: (to) => finish(() => movePlace(moving.id, to)),
            rename: (name) => finish(() => renamePlace(moving.id, name)),
            expiry: (d) => finish(() => setExpiry(moving.id, d)),
            addPlace: (p, name, kind) => finish(() => addPlace(p, name, kind)),
            addItem: (name) => finish(() => addItem(moving.id, name)),
          }}
        />
      )}
    </section>
  );
}

type BranchProps = {
  node: HomeNode;
  depth: number;
  kids: Map<string, HomeNode[]>;
  open: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  select: (n: HomeNode) => void;
  onMove: (n: HomeNode) => void;
  note: string;
  setNote: (v: string) => void;
  reload: () => Promise<void>;
  today: string;
  pickPhoto: () => void;
};

// One row of the tree: ▸/▾ on the left, direct-child count on the right. Tap
// the name to pick a place for a photo; long-press to move it.
function Branch(props: BranchProps) {
  const { node, depth, kids, open, toggle, selectedId, select, onMove, note, setNote, reload, today, pickPhoto } = props;
  const children = kids.get(node.id) ?? [];
  const isContainer = node.kind === 'container';
  const level = stockLevel(node);
  const [levelOpen, setLevelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const isItem = node.kind === 'item';
  const isOpen = open.has(node.id);
  const isSel = selectedId === node.id;
  const press = useLongPress({
    onShortPress: () => {
      if (isItem) {
        if (level) {
          haptic('tap');
          setLevelOpen((v) => !v);
        }
        return;
      }
      haptic('tap');
      select(node);
    },
    onLongPress: () => onMove(node),
  });
  return (
    <li>
      <div style={{ paddingLeft: `${depth * 1.1}rem` }} className="flex items-center">
        {children.length || isContainer ? (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              toggle(node.id);
            }}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={isOpen}
            className="w-8 shrink-0 py-2 text-center text-slate-400"
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-8 shrink-0" />
        )}
        <button
          type="button"
          {...press}
          className={`flex min-w-0 flex-1 select-none items-baseline justify-between gap-2 rounded-lg py-2 pr-3 text-left transition ${
            isSel ? 'bg-emerald-500/10 text-emerald-200' : isItem ? 'text-slate-400' : depth === 0 ? 'font-medium text-slate-100' : 'text-slate-300'
          }`}
        >
          <span className="flex min-w-0 items-center truncate">
            {level && <span className={`mr-2 inline-block h-2 w-2 shrink-0 rounded-full ${LEVEL_STYLE[level].dot}`} />}
            {node.kind === 'container' ? '📦 ' : ''}
            {node.name}
            {isItem && node.qty != null && (
              <span className="ml-1 text-xs text-slate-600">
                ×{node.qty}
                {node.unit && node.unit !== 'pcs' ? ` ${node.unit}` : ''}
              </span>
            )}
          </span>
          {isItem && node.expires_on && (() => {
            const e = expiryLabel(node.expires_on, today);
            return (
              <span className={`shrink-0 text-xs ${e.tone === 'bad' ? 'text-rose-300' : e.tone === 'soon' ? 'text-orange-300' : 'text-slate-500'}`}>
                {e.text}
              </span>
            );
          })()}
          {level && level !== 'good' && (
            <span className={`shrink-0 text-xs ${level === 'full' ? 'text-emerald-300/80' : level === 'low' ? 'text-amber-300' : 'text-rose-300'}`}>
              {LEVEL_STYLE[level].label}
            </span>
          )}
          {children.length > 0 && <span className="shrink-0 text-xs text-slate-500">{children.length}</span>}
        </button>
      </div>
      {levelOpen && level && (
        <div className="mb-2 flex flex-wrap gap-2 pl-8 pr-3" style={{ marginLeft: `${depth * 1.1}rem` }}>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={async () => {
                haptic('tap');
                setErr(null);
                try {
                  await setLevel(node.id, l);
                  await reload();
                  setLevelOpen(false);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e));
                }
              }}
              className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${
                l === level ? LEVEL_STYLE[l].chip : 'border-slate-800 text-slate-400'
              }`}
            >
              {LEVEL_STYLE[l].label}
            </button>
          ))}
          {err && <span className="text-xs text-rose-300">{err}</span>}
        </div>
      )}
      {isSel && (
        <div className="mb-2 mt-1 flex items-center gap-2 pl-8 pr-3" style={{ marginLeft: `${depth * 1.1}rem` }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Alternative name (optional) — this spot only"
            className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={pickPhoto}
            aria-label={`Photo of ${node.name}`}
            className="shrink-0 rounded-full border border-emerald-700 bg-emerald-500/15 p-2 text-lg leading-none transition active:scale-95 hover:bg-emerald-500/25"
          >
            📷
          </button>
        </div>
      )}
      {isOpen && (children.length > 0 || isContainer) && (
        <ul className="flex flex-col">
          {children.map((c) => (
            <Branch key={c.id} {...props} node={c} depth={depth + 1} />
          ))}
          {isContainer && (
            <li style={{ paddingLeft: `${(depth + 1) * 1.1}rem` }} className="pl-8">
              <form
                className="flex items-center gap-2 py-1 pr-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = draft.trim();
                  if (!name) return;
                  setErr(null);
                  try {
                    await addItem(node.id, name);
                    setDraft('');
                    haptic('successRamp');
                    await reload();
                  } catch (e2) {
                    setErr(e2 instanceof Error ? e2.message : String(e2));
                  }
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`＋ Add to ${node.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
                />
                {draft.trim() && (
                  <button type="submit" className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm text-emerald-50 active:scale-95">
                    Add
                  </button>
                )}
              </form>
              {err && <p className="text-xs text-rose-300">{err}</p>}
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function FilterRow({ node, path, today, onOpen }: { node: HomeNode; path: string; today: string; onOpen: () => void }) {
  const level = stockLevel(node);
  const press = useLongPress({ onShortPress: onOpen, onLongPress: onOpen });
  const exp = node.expires_on ? expiryLabel(node.expires_on, today) : null;
  return (
    <li>
      <button type="button" {...press} className="flex w-full select-none items-center gap-3 rounded-lg px-2 py-2 text-left">
        {level && <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_STYLE[level].dot}`} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-slate-100">{node.name}</span>
          <span className="block truncate text-xs text-slate-500">{path.split(' › ').slice(0, -1).join(' › ')}</span>
        </span>
        {exp && (
          <span className={`shrink-0 text-xs ${exp.tone === 'bad' ? 'text-rose-300' : exp.tone === 'soon' ? 'text-orange-300' : 'text-slate-500'}`}>
            {exp.text}
          </span>
        )}
      </button>
    </li>
  );
}

type SheetMode = 'menu' | 'level' | 'expiry' | 'rename' | 'add' | 'move' | 'type';

type SheetOps = {
  level: (l: Level) => Promise<void>;
  type: (t: Category) => Promise<void>;
  move: (to: string) => Promise<void>;
  rename: (name: string) => Promise<void>;
  expiry: (date: string | null) => Promise<void>;
  addPlace: (parent: Place, name: string, kind: Place['kind']) => Promise<void>;
  addItem: (name: string) => Promise<void>;
};

// Long-press sheet. Items: stock level, expiry, rename, move, type. Containers: rename, add inside, move, type.
// Places: rename, add inside, move. Delete stays in ⚙️ settings.
function ActionSheet({
  node,
  place,
  targets,
  onClose,
  ops,
}: {
  node: HomeNode;
  place: Place | null;
  targets: Place[];
  onClose: () => void;
  ops: SheetOps;
}) {
  const isItem = node.kind === 'item';
  const isContainer = node.kind === 'container';
  const current = stockLevel(node);
  const [mode, setMode] = useState<SheetMode>('menu');
  const [text, setText] = useState('');
  const [date, setDate] = useState(node.expires_on ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const row = 'w-full rounded px-2 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50';
  const input =
    'min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none';
  const btn = 'rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-50 transition active:scale-95 disabled:opacity-50';
  const title: Record<SheetMode, string> = {
    menu: '',
    level: ' — how much is left?',
    expiry: ' — expiry date',
    rename: ' — rename',
    add: ' — add inside',
    move: ' — move into…',
    type: ' — is a…',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            <span className="text-slate-100">{node.name}</span>
            {title[mode]}
          </span>
          <button type="button" onClick={mode === 'menu' ? onClose : () => setMode('menu')} className="px-1 text-slate-500">
            {mode === 'menu' ? '✕' : '‹ Back'}
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-rose-300">{error}</p>}

        {mode === 'menu' && (
          <ul>
            {current && (
              <li>
                <button type="button" className={row} onClick={() => setMode('level')}>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[current].dot}`} />
                  Stock level · {LEVEL_STYLE[current].label}
                </button>
              </li>
            )}
            {isItem && (
              <li>
                <button type="button" className={row} onClick={() => setMode('expiry')}>
                  📅 Expiry date{node.expires_on ? ` · ${node.expires_on}` : ''}
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                className={row}
                onClick={() => {
                  setText(node.name);
                  setMode('rename');
                }}
              >
                ✎ Rename
              </button>
            </li>
            {(place || isContainer) && !isItem && (
              <li>
                <button
                  type="button"
                  className={row}
                  onClick={() => {
                    setText('');
                    setMode('add');
                  }}
                >
                  ＋ Add inside
                </button>
              </li>
            )}
            <li>
              <button type="button" className={row} onClick={() => setMode('move')}>
                ↗ Move
              </button>
            </li>
            {(isItem || isContainer) && (
              <li>
                <button type="button" className={row} onClick={() => setMode('type')}>
                  🏷 Change type
                </button>
              </li>
            )}
          </ul>
        )}

        {mode === 'level' && (
          <ul>
            {LEVELS.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  disabled={busy}
                  className={`${row} ${l === current ? 'text-slate-100' : ''}`}
                  onClick={() => void run(() => ops.level(l))}
                >
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[l].dot}`} />
                  {LEVEL_STYLE[l].label}
                  {l === current ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ul>
        )}

        {mode === 'expiry' && (
          <div className="flex flex-col gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            <div className="flex gap-2">
              <button type="button" disabled={busy || !date} className={btn} onClick={() => void run(() => ops.expiry(date))}>
                Save
              </button>
              {node.expires_on && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 active:scale-95"
                  onClick={() => void run(() => ops.expiry(null))}
                >
                  Clear date
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'rename' && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void run(() => ops.rename(text.trim()));
            }}
          >
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={input} />
            <button type="submit" disabled={busy || !text.trim()} className={btn}>
              Save
            </button>
          </form>
        )}

        {mode === 'add' && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              if (isContainer) void run(() => ops.addItem(text.trim()));
              else if (place) void run(() => ops.addPlace(place, text.trim(), childKind(place)));
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isContainer ? 'New item — e.g. Milk' : 'New spot — e.g. Shelf 1'}
              className={input}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !text.trim()} className={btn}>
                {isContainer ? 'Add item' : 'Add spot'}
              </button>
              {place && !isContainer && (
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-95 disabled:opacity-50"
                  onClick={() => void run(() => ops.addPlace(place, text.trim(), 'container'))}
                >
                  📦 Add container
                </button>
              )}
            </div>
          </form>
        )}

        {mode === 'type' && (
          <ul>
            {TYPE_OPTIONS.map((t) => (
              <li key={t.value}>
                <button
                  type="button"
                  disabled={busy}
                  className={`${row} ${node.category === t.value ? 'text-emerald-200' : ''}`}
                  onClick={() => void run(() => ops.type(t.value))}
                >
                  {t.label}
                  {node.category === t.value ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ul>
        )}

        {mode === 'move' && (
          <ul>
            {targets.map((t) => (
              <li key={t.id}>
                <button type="button" disabled={busy} className={row} onClick={() => void run(() => ops.move(t.id))}>
                  {t.path.split(' › ').slice(1).join(' › ') || t.path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
