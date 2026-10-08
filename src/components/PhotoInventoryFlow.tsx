import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';
import {
  addPhotoCard,
  cardLevel,
  LEVELS,
  LEVEL_STYLE,
  clearPhotoDraft,
  commitPhoto,
  decidePhotoCard,
  loadPhotoDraft,
  nextPendingPhotoIndex,
  photoToBase64,
  proposePhoto,
  savePhotoDraft,
  summarizePhoto,
  toPhotoCards,
  TYPE_OPTIONS,
  type Category,
  type PhotoCard,
  type PhotoCommitResult,
  type PhotoDraft,
  type Place,
} from '../lib/home';
import { ActionButton } from './TriageFlow';

export type PhotoStart = { file: File; place: Place; note: string };

interface Props {
  /** A fresh photo to read; omitted → resume the saved draft. */
  start?: PhotoStart;
  onCommitted: () => void;
  onExit: () => void;
}

type Stage = 'reading' | 'review' | 'summary' | 'committing' | 'result' | 'failed';

// Photo of a place → agent proposes what's in it → review one card at a time
// (same rhythm as Task Triage) → confirm → one add_batch call. The review is
// saved to localStorage as it goes, so leaving mid-way resumes.
export function PhotoInventoryFlow({ start, onCommitted, onExit }: Props) {
  const [draft, setDraft] = useState<PhotoDraft | null>(() => (start ? null : loadPhotoDraft()));
  const [stage, setStage] = useState<Stage>(start ? 'reading' : 'review');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoCommitResult | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const editRef = useRef<HTMLInputElement>(null);
  const editCancelled = useRef<boolean>(false);
  const started = useRef<boolean>(false);
  const [addText, setAddText] = useState<string>('');
  const [addCategory, setAddCategory] = useState<Category>('perishable');
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const cards = draft?.cards ?? [];
  const index = draft?.index ?? 0;
  const current: PhotoCard | undefined = cards[index];

  // Read the photo once on mount (StrictMode mounts twice in dev).
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const image = await photoToBase64(start.file);
        const proposal = await proposePhoto(image, start.place.id, start.note);
        const next: PhotoDraft = { ...proposal, cards: toPhotoCards(proposal.items), index: 0 };
        setDraft(next);
        if (next.cards.length === 0) {
          setError(proposal.notes || 'Nothing recognisable in that photo');
          setStage('failed');
          return;
        }
        haptic('tap');
        setStage('review');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStage('failed');
      }
    })();
  }, [start]);

  useEffect(() => {
    if (draft && draft.cards.length && (stage === 'review' || stage === 'summary')) savePhotoDraft(draft);
  }, [draft, stage]);

  useEffect(() => setJustAdded(null), [index]);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  function update(patch: Partial<PhotoCard>) {
    setDraft((d) => d && { ...d, cards: d.cards.map((c, i) => (i === d.index ? { ...c, ...patch } : c)) });
  }

  function goTo(list: PhotoCard[], from: number) {
    const n = nextPendingPhotoIndex(list, from);
    setDraft((d) => d && { ...d, cards: list, index: n === -1 ? d.index : n });
    if (n === -1 || n === from) setStage('summary');
  }

  function decide(decision: 'accepted' | 'dropped') {
    if (!draft) return;
    haptic('tap');
    goTo(decidePhotoCard(draft.cards, draft.index, decision), draft.index);
  }

  function skip() {
    if (!draft) return;
    haptic('tap');
    goTo(draft.cards, draft.index);
  }

  // Add by hand: inside this card when it is a container, otherwise next to it (same container).
  function addHere() {
    if (!draft || !current || !addText.trim()) return;
    const parent = current.kind === 'container' ? current : (cards.find((c) => c.n === current.parentN) ?? null);
    const added = addPhotoCard(draft.cards, draft.index, parent, addText, addCategory);
    haptic('tap');
    setJustAdded(addText.trim());
    setAddText('');
    // A new box is where the next things go — jump to it so the input now targets it.
    setDraft((d) => d && { ...d, cards: added.cards, index: addCategory === 'container' ? added.index : d.index });
  }

  function startEdit() {
    if (!current) return;
    setEditText(current.name);
    editCancelled.current = false;
    setEditing(true);
  }

  function saveEdit() {
    if (editCancelled.current || !editing) return;
    const name = editText.trim();
    // Renaming is how "What's inside?" gets answered.
    if (name) update({ name, question: null, confidence: 'high' });
    setEditing(false);
  }

  async function commit() {
    if (!draft) return;
    haptic('tap');
    setError(null);
    setStage('committing');
    try {
      setResult(await commitPhoto(draft));
      clearPhotoDraft();
      setStage('result');
      haptic('successRamp');
      onCommitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('summary');
    }
  }

  function discard() {
    clearPhotoDraft();
    onExit();
  }

  const exitButton = (label: string) => (
    <button type="button" onClick={onExit} className="text-sm text-slate-500 hover:text-slate-200">
      ✕ {label}
    </button>
  );

  const header = (label: string, right: string) => (
    <div className="flex items-center justify-between">
      {exitButton(label)}
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{right}</span>
    </div>
  );

  // ── Reading / failed ─────────────────────────────────────────────────────
  if (stage === 'reading' || stage === 'failed') {
    return (
      <section className="flex flex-col gap-5">
        {header('Back', 'Photo')}
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">{stage === 'reading' ? '🔍' : '😕'}</p>
          <p className="text-lg font-semibold text-slate-100">
            {stage === 'reading' ? `Reading ${start?.place.path.split(' › ').pop() ?? 'photo'}…` : 'Couldn’t read that'}
          </p>
          <p className="text-sm text-slate-500">
            {stage === 'reading' ? 'About 30 seconds. Nothing is saved until you confirm.' : error}
          </p>
        </div>
        {stage === 'failed' && (
          <ActionButton tone="slate" onClick={discard}>
            Back to Kitchen
          </ActionButton>
        )}
      </section>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (stage === 'result' && result) {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-4xl">✅</p>
        <p className="text-lg font-semibold text-slate-100">Saved {result.added} things</p>
        <p className="text-sm text-slate-500">{draft?.place}</p>
        {result.skipped > 0 && <p className="text-sm text-slate-500">{result.skipped} already there — skipped</p>}
        {result.errors.length > 0 && (
          <div className="text-sm text-rose-300">
            {result.errors.map((err) => (
              <p key={err}>{err}</p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onExit}
          className="mt-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 text-sm text-slate-200 transition active:scale-95 hover:border-slate-600"
        >
          Next shelf →
        </button>
      </section>
    );
  }

  // ── Summary / confirm ────────────────────────────────────────────────────
  if (stage === 'summary' || stage === 'committing' || !current || !draft) {
    const s = summarizePhoto(cards);
    const committing = stage === 'committing';
    return (
      <section className="flex flex-col gap-5">
        {header('Later', 'Confirm')}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-xs text-slate-500">{draft?.place}</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            Save {s.save}
            {s.dropped > 0 && <span className="text-slate-500"> · drop {s.dropped}</span>}
          </p>
          {s.pending > 0 && <p className="mt-1 text-sm text-amber-300">{s.pending} skipped — tap one to review</p>}
          <ul className="mt-4 flex flex-col gap-1.5">
            {cards.map((c, i) => (
              <li key={c.n}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => d && { ...d, index: i, cards: d.cards.map((x, j) => (j === i ? { ...x, decision: 'pending' } : x)) });
                    setStage('review');
                  }}
                  className="flex w-full items-baseline gap-2 text-left text-sm"
                  style={{ paddingLeft: c.parentN !== null ? '1.25rem' : 0 }}
                >
                  <span className="w-4 shrink-0">{c.decision === 'accepted' ? '✓' : c.decision === 'dropped' ? '✕' : '·'}</span>
                  <span
                    className={
                      c.decision === 'dropped'
                        ? 'text-slate-600 line-through'
                        : c.decision === 'pending'
                          ? 'text-amber-200'
                          : 'text-slate-200'
                    }
                  >
                    {c.kind === 'container' ? '📦 ' : ''}
                    {c.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="flex flex-col gap-3">
          <ActionButton tone="emerald" onClick={() => void commit()} disabled={committing || s.save === 0}>
            {committing ? 'Saving…' : `✓ Confirm — save ${s.save}`}
          </ActionButton>
          <ActionButton tone="ghost" onClick={discard} disabled={committing}>
            Discard this photo
          </ActionButton>
        </div>
      </section>
    );
  }

  // ── Review card ──────────────────────────────────────────────────────────
  const decided = cards.filter((c) => c.decision !== 'pending').length;
  const showExpiry = current.category === 'perishable' || Boolean(current.expires_on);
  const showReplace = current.category === 'cleaning' || Boolean(current.replace_every_days);
  return (
    <section className="flex flex-col gap-6">
      {header('Later', `${decided + 1} of ${cards.length}`)}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="mb-2 text-xs text-slate-500">
          {draft.place.split(' › ').slice(1).join(' › ')}
          {current.inside && <span className="text-slate-400"> › inside {current.inside}</span>}
        </p>
        {current.question && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">❓ {current.question}</p>
        )}
        {editing ? (
          <input
            ref={editRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                editCancelled.current = true;
                setEditing(false);
              }
            }}
            onBlur={saveEdit}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-base text-slate-100 focus:outline-none"
          />
        ) : (
          <button type="button" onClick={startEdit} className="text-left text-lg font-medium text-slate-100">
            {current.kind === 'container' ? '📦 ' : ''}
            {current.name}
          </button>
        )}
        {current.aliases.length > 0 && <p className="mt-1 text-xs text-slate-500">aka {current.aliases.join(', ')}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={current.category}
            onChange={(e) => {
              const category = e.target.value as Category;
              update({ category, kind: category === 'container' ? 'container' : 'item' });
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300 focus:outline-none"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {current.qty !== null && (
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">
              {current.qty} {current.unit ?? ''}
            </span>
          )}
          {showExpiry && (
            <label className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
              📅 Expires
              <input
                type="date"
                value={current.expires_on ?? ''}
                onChange={(e) => update({ expires_on: e.target.value || null })}
                className="bg-transparent text-slate-100 focus:outline-none"
              />
            </label>
          )}
          {showReplace && (
            <label className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
              🔁 every
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={current.replace_every_days ?? ''}
                onChange={(e) => update({ replace_every_days: Number.parseInt(e.target.value, 10) || null })}
                className="w-12 bg-transparent text-slate-100 focus:outline-none"
              />
              days
            </label>
          )}
        </div>

        {cardLevel(current) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  haptic('tap');
                  update({ attrs: { ...current.attrs, level: l } });
                }}
                className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${
                  l === cardLevel(current) ? LEVEL_STYLE[l].chip : 'border-slate-800 text-slate-400'
                }`}
              >
                {LEVEL_STYLE[l].label}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-5 border-t border-slate-800 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            addHere();
          }}
        >
          <div className="flex items-center gap-2">
            <input
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder={
                current.kind === 'container'
                  ? `＋ Add inside ${current.name}`
                  : current.inside
                    ? `＋ Add another inside ${current.inside}`
                    : '＋ Add another thing here'
              }
              className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
            />
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value as Category)}
              aria-label="Type of the new thing"
              className="max-w-[6.5rem] rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2 text-xs text-slate-300 focus:outline-none"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {addText.trim() && (
              <button type="submit" className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-50 active:scale-95">
                Add
              </button>
            )}
          </div>
          {justAdded && <p className="mt-2 text-xs text-slate-500">Added “{justAdded}” ✓ — add more, or carry on.</p>}
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <ActionButton tone="emerald" onClick={() => decide('accepted')}>
          ✓ Looks right
        </ActionButton>
        <ActionButton tone="slate" onClick={startEdit}>
          ✎ Rename
        </ActionButton>
        <ActionButton tone="rose" onClick={() => decide('dropped')}>
          {current.kind === 'container' ? '✕ Drop (and what’s inside)' : '✕ Drop'}
        </ActionButton>
        <ActionButton tone="ghost" onClick={skip}>
          Skip →
        </ActionButton>
      </div>
    </section>
  );
}
