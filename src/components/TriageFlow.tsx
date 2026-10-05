import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptic';
import { formatDayLabelLong } from '../lib/time';
import {
  clearTriageDraft,
  commitTriage,
  loadTriageDraft,
  nextPendingIndex,
  proposeTriage,
  saveTriageDraft,
  summarize,
  toReviewCards,
  type TriageCard,
  type TriageCommitResult,
} from '../lib/triage';
import { DateSheet } from './DateSheet';
import { ProjectSheet } from './ProjectSheet';
import { TypedDateBar } from './TypedDateBar';

interface Props {
  projects: string[] | null;
  /** Desktop only — single-key review (x/e/p/d/⇧X/space/esc) + key hints. */
  keyboard?: boolean;
  onCreateProject: (name: string) => Promise<string>;
  /** Fired after a successful commit so the Tasks list can re-pull. */
  onCommitted: () => void;
  onExit: () => void;
}

type Stage = 'input' | 'sorting' | 'review' | 'summary' | 'committing' | 'result';

function parseISTDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`);
}

// Paste a raw task dump → agent proposes project + date per line → review one
// card at a time (same rhythm as ReplanFlow) → confirm → one add_batch call.
// The review is saved to localStorage as it goes, so leaving mid-way resumes.
export function TriageFlow({ projects, keyboard, onCreateProject, onCommitted, onExit }: Props) {
  const [draft] = useState(() => loadTriageDraft());
  const [stage, setStage] = useState<Stage>(draft ? 'review' : 'input');
  const [raw, setRaw] = useState<string>('');
  const [cards, setCards] = useState<TriageCard[]>(draft?.cards ?? []);
  const [index, setIndex] = useState<number>(draft?.index ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageCommitResult | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const [projectOpen, setProjectOpen] = useState<boolean>(false);
  const [dateOpen, setDateOpen] = useState<boolean>(false);
  // Keyboard only: the full DateSheet, reached from the typed bar via tab.
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  const editRef = useRef<HTMLInputElement>(null);
  // Esc on the edit box must not let the follow-up blur save the draft.
  const editCancelled = useRef<boolean>(false);

  const current: TriageCard | undefined = cards[index];
  const typedDate = Boolean(keyboard) && dateOpen;
  const sheetOpen = projectOpen || dateOpen || moreOpen || editing;

  // Persist the review as it goes; cleared on commit or discard.
  useEffect(() => {
    if (stage === 'review' || stage === 'summary') saveTriageDraft({ cards, index });
  }, [stage, cards, index]);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  function update(patch: Partial<TriageCard>) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function decide(decision: TriageCard['decision']) {
    haptic('tap');
    const next = cards.map((c, i) => (i === index ? { ...c, decision } : c));
    setCards(next);
    advanceFrom(next, index);
  }

  function skip() {
    haptic('tap');
    advanceFrom(cards, index);
  }

  function advanceFrom(list: TriageCard[], from: number) {
    const n = nextPendingIndex(list, from);
    // n === from: the card just skipped is the only one left → summary,
    // where it shows as skipped and can be reopened.
    if (n === -1 || n === from) {
      setStage('summary');
    } else {
      setIndex(n);
    }
  }

  function startEdit() {
    if (!current) return;
    setEditText(current.text);
    editCancelled.current = false;
    setEditing(true);
  }

  function saveEdit() {
    if (editCancelled.current || !editing) return;
    const text = editText.trim();
    // Editing the text is how a question gets answered.
    if (text) update({ text, question: null, confidence: 'high' });
    setEditing(false);
  }

  function closeDate() {
    setDateOpen(false);
    setMoreOpen(false);
  }

  async function sort() {
    if (!raw.trim()) return;
    haptic('tap');
    setError(null);
    setStage('sorting');
    try {
      const items = await proposeTriage(raw);
      if (items.length === 0) throw new Error('No tasks found in that text');
      setCards(toReviewCards(items));
      setIndex(0);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('input');
    }
  }

  async function commit() {
    haptic('tap');
    setError(null);
    setStage('committing');
    try {
      const res = await commitTriage(cards);
      setResult(res);
      clearTriageDraft();
      setStage('result');
      haptic('successRamp');
      onCommitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('summary');
    }
  }

  function discard() {
    clearTriageDraft();
    onExit();
  }

  // Single-key review, mirroring ReplanFlow: x/↵ accept, e edit, p project,
  // d date, ⇧X drop, space/→/j skip, esc exit (draft is kept).
  useEffect(() => {
    if (!keyboard || stage !== 'review') return;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;
      if (sheetOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDate();
          setProjectOpen(false);
          setEditing(false);
        }
        return;
      }
      if (!current) return;

      if (e.shiftKey && e.code === 'KeyX') {
        e.preventDefault();
        decide('dropped');
        return;
      }

      switch (e.key) {
        case 'x':
        case 'Enter':
          e.preventDefault();
          decide('accepted');
          break;
        case 'e':
          e.preventDefault();
          startEdit();
          break;
        case 'p':
          e.preventDefault();
          setProjectOpen(true);
          break;
        case 'd':
          e.preventDefault();
          setDateOpen(true);
          break;
        case ' ':
        case 'ArrowRight':
        case 'j':
          e.preventDefault();
          skip();
          break;
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // decide/skip close over cards/index; re-subscribe as those change.
  }, [keyboard, stage, sheetOpen, current, cards, index, onExit]);

  const exitButton = (label: string) => (
    <button
      type="button"
      onClick={onExit}
      aria-label="Exit triage"
      className="text-sm text-slate-500 hover:text-slate-200"
    >
      ✕ {label}
      {keyboard && <span className="ml-1 text-slate-600">esc</span>}
    </button>
  );

  // ── Paste ────────────────────────────────────────────────────────────────
  if (stage === 'input' || stage === 'sorting') {
    const sorting = stage === 'sorting';
    const lineCount = raw.split('\n').filter((l) => l.trim()).length;
    return (
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          {exitButton('Exit')}
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Triage</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-100">📥 Drop your list</p>
          <p className="mt-1 text-sm text-slate-500">
            Paste from WhatsApp. The agent sorts each line into a project and date — you review
            every card before anything is filed.
          </p>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={sorting}
          autoFocus
          rows={12}
          placeholder={'1. Meal plan update\n2. Porter follow up\n3. Recliner moving done'}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none disabled:opacity-60"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <ActionButton tone="emerald" onClick={() => void sort()} disabled={sorting || !raw.trim()}>
          {sorting ? `Sorting ${lineCount} lines… (~1 min)` : 'Sort it →'}
        </ActionButton>
      </section>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (stage === 'result' && result) {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-4xl">✅</p>
        <p className="text-lg font-semibold text-slate-100">Filed {result.added} tasks</p>
        {result.skipped > 0 && (
          <p className="text-sm text-slate-500">{result.skipped} already existed — skipped</p>
        )}
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
          Back to Tasks
        </button>
      </section>
    );
  }

  // ── Summary / confirm ────────────────────────────────────────────────────
  if (stage === 'summary' || stage === 'committing' || !current) {
    const s = summarize(cards);
    const committing = stage === 'committing';
    return (
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          {exitButton('Later')}
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Confirm</span>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-lg font-semibold text-slate-100">
            File {s.file}
            {s.logDone > 0 && <span className="text-emerald-300"> · log {s.logDone} done</span>}
            {s.dropped > 0 && <span className="text-slate-500"> · drop {s.dropped}</span>}
          </p>
          {s.pending > 0 && (
            <p className="mt-1 text-sm text-amber-300">{s.pending} skipped — tap one to review</p>
          )}
          <ul className="mt-4 flex flex-col gap-1.5">
            {cards.map((c, i) => (
              <li key={`${c.n}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setCards((prev) => prev.map((x, j) => (j === i ? { ...x, decision: 'pending' } : x)));
                    setStage('review');
                  }}
                  className="flex w-full items-baseline gap-2 text-left text-sm"
                >
                  <span className="w-4 shrink-0">
                    {c.decision === 'accepted' ? (c.done ? '☑' : '✓') : c.decision === 'dropped' ? '✕' : '·'}
                  </span>
                  <span
                    className={
                      c.decision === 'dropped'
                        ? 'text-slate-600 line-through'
                        : c.decision === 'pending'
                          ? 'text-amber-200'
                          : 'text-slate-200'
                    }
                  >
                    {c.text}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-slate-500">{c.project}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="flex flex-col gap-3">
          <ActionButton
            tone="emerald"
            onClick={() => void commit()}
            disabled={committing || s.file + s.logDone === 0}
          >
            {committing ? 'Filing…' : `✓ Confirm — file ${s.file + s.logDone}`}
          </ActionButton>
          <ActionButton tone="ghost" onClick={discard} disabled={committing}>
            Discard this triage
          </ActionButton>
        </div>
      </section>
    );
  }

  // ── Review card ──────────────────────────────────────────────────────────
  const pendingLeft = cards.filter((c) => c.decision === 'pending').length;
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {exitButton('Later')}
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {cards.length - pendingLeft + 1} of {cards.length}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        {current.question && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            ❓ {current.question}
          </p>
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
          <button type="button" onClick={startEdit} className="text-left text-base text-slate-100">
            {current.text}
          </button>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Chip onClick={() => setProjectOpen(true)} hint={keyboard ? 'p' : undefined}>
            🗂 {current.project}
          </Chip>
          <Chip onClick={() => setDateOpen(true)} hint={keyboard ? 'd' : undefined}>
            📅 {current.due ? formatDayLabelLong(parseISTDate(current.due)) : 'No date'}
          </Chip>
          <Chip onClick={() => update({ done: !current.done })} active={current.done}>
            {current.done ? '☑ Already done' : '☐ Already done?'}
          </Chip>
        </div>
        {current.original && current.original !== current.text && (
          <p className="mt-3 text-xs text-slate-600">You wrote: “{current.original}”</p>
        )}
      </div>

      {typedDate ? (
        <TypedDateBar
          onPick={(date) => {
            update({ due: date });
            closeDate();
          }}
          onClose={closeDate}
          onMore={() => {
            setDateOpen(false);
            setMoreOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ActionButton tone="emerald" hint={keyboard ? 'X' : undefined} onClick={() => decide('accepted')}>
            {current.done ? '✓ Log as done' : '✓ Looks right'}
          </ActionButton>
          <ActionButton tone="slate" hint={keyboard ? 'E' : undefined} onClick={startEdit}>
            ✎ Edit text
          </ActionButton>
          <ActionButton tone="rose" hint={keyboard ? '⇧X' : undefined} onClick={() => decide('dropped')}>
            ✕ Drop
          </ActionButton>
          <ActionButton tone="ghost" hint={keyboard ? '␣' : undefined} onClick={skip}>
            Skip →
          </ActionButton>
        </div>
      )}

      <DateSheet
        open={(dateOpen && !keyboard) || moreOpen}
        taskTitle={current.text}
        currentDue={current.due}
        onClose={closeDate}
        onPick={(date) => {
          update({ due: date ?? '' });
          closeDate();
        }}
      />
      <ProjectSheet
        open={projectOpen}
        taskTitle={current.text}
        currentProject={current.project}
        projects={projects}
        onClose={() => setProjectOpen(false)}
        onPick={(project) => {
          update({ project });
          setProjectOpen(false);
        }}
        onCreate={async (name) => {
          const project = await onCreateProject(name);
          update({ project });
          setProjectOpen(false);
          return project;
        }}
      />
    </section>
  );
}

function Chip({
  children,
  onClick,
  hint,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hint?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={`rounded-full border px-2.5 py-1 transition active:scale-95 ${
        active
          ? 'border-emerald-700 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
      }`}
    >
      {children}
      {hint && <kbd className="ml-1.5 font-mono text-[10px] opacity-60">{hint}</kbd>}
    </button>
  );
}

function ActionButton({
  children,
  tone,
  hint,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  tone: 'emerald' | 'slate' | 'rose' | 'ghost';
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors =
    tone === 'emerald'
      ? 'bg-emerald-500 text-emerald-50 hover:bg-emerald-400'
      : tone === 'slate'
        ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600'
        : tone === 'rose'
          ? 'border border-rose-900/70 bg-slate-900 text-rose-300 hover:border-rose-700'
          : 'text-slate-400 hover:text-slate-200';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-xl py-3 text-base font-medium transition active:scale-95 disabled:opacity-50 ${colors}`}
    >
      {children}
      {hint && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-current px-1.5 py-0.5 font-mono text-[11px] opacity-60">
          {hint}
        </kbd>
      )}
    </button>
  );
}
