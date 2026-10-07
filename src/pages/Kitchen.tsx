import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';
import { fetchPlaces, loadPhotoDraft, type Place } from '../lib/home';
import { PhotoInventoryFlow, type PhotoStart } from '../components/PhotoInventoryFlow';
import { KitchenLayout } from '../components/KitchenLayout';

// Kitchen tab, v1: pick a place, photograph it, review what the agent saw.
// The visual kitchen map and due list come next (see 960 Agents/so-home).
export default function Kitchen() {
  const [places, setPlaces] = useState<Place[] | null>(null);
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
      setPlaces(await fetchPlaces());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          <p className="mt-1 text-sm text-slate-500">Pick a spot, snap a photo — you review everything before it’s saved.</p>
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
      {!places && !error && <p className="text-sm text-slate-500">Loading places…</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && selected) setFlow({ file, place: selected, note });
        }}
      />

      {places && (
        <ul className="flex flex-col gap-1">
          {places
            .filter((p) => p.kind !== 'space')
            .map((p) => {
              const parts = p.path.split(' › ');
              const depth = parts.length - 2;
              const isSel = selected?.id === p.id;
              return (
                <li key={p.id} style={{ paddingLeft: `${depth * 1.25}rem` }}>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('tap');
                      setSelected(isSel ? null : p);
                    }}
                    className={`flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left transition ${
                      isSel ? 'bg-emerald-500/10 text-emerald-200' : depth === 0 ? 'text-slate-100' : 'text-slate-300'
                    }`}
                  >
                    <span className={depth === 0 ? 'font-medium' : ''}>
                      {p.kind === 'container' ? '📦 ' : ''}
                      {parts[parts.length - 1]}
                    </span>
                    {p.items > 0 && <span className="text-xs text-slate-500">{p.items}</span>}
                  </button>
                  {isSel && (
                    <div className="mb-2 mt-1 flex flex-col gap-2 px-3">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Hint (optional) — e.g. masala shelf"
                        className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-xl bg-emerald-500 py-3 text-base font-medium text-emerald-50 transition active:scale-95 hover:bg-emerald-400"
                      >
                        📷 Photo of {parts.slice(1).join(' › ')}
                      </button>
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
