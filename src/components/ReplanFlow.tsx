import { useEffect, useState } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { DateSheet } from './DateSheet';
import { TypedDateBar } from './TypedDateBar';

interface Props {
  tasks: Task[];
  /** Desktop only — enable single-key triage (x/⇧X/d/space/esc) + show key hints. */
  keyboard?: boolean;
  onComplete: (id: string | null) => void;
  onCancel: (id: string | null) => void;
  onReschedule: (id: string | null, date: string | null) => void;
  onExit: () => void;
}

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  OVERDUE: 'Overdue',
  TODAY: 'Today',
  THIS_WEEK: 'This week',
  FUTURE: 'Later',
  NO_DATE: 'No date',
};

const CATEGORY_TONE: Record<TaskCategory, string> = {
  OVERDUE: 'text-rose-300',
  TODAY: 'text-emerald-300',
  THIS_WEEK: 'text-slate-300',
  FUTURE: 'text-slate-400',
  NO_DATE: 'text-slate-400',
};

export function ReplanFlow({
  tasks,
  keyboard,
  onComplete,
  onCancel,
  onReschedule,
  onExit,
}: Props) {
  const [index, setIndex] = useState<number>(0);
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  // Keyboard only: the full DateSheet, reached from the typed bar via tab.
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  const current: Task | undefined = tasks[index];

  // On keyboard devices, "Reschedule" swaps the action buttons for an inline
  // typed date bar (@tomorrow / fri / 3d / 2026-08-05). Touch keeps the sheet.
  const typedReschedule = Boolean(keyboard) && datePickerOpen;

  function openReschedule() {
    setDatePickerOpen(true);
  }

  function closeReschedule() {
    setDatePickerOpen(false);
    setMoreOpen(false);
  }

  function advance() {
    if (index + 1 >= tasks.length) {
      onExit();
    } else {
      setIndex((i) => i + 1);
    }
  }

  // Single-key triage. While the date sheet is open its own inputs own the
  // keyboard (Esc closes it); otherwise x/↵=done, ⇧X=cancel, d=reschedule,
  // space/→/j=skip, esc=exit — same keys as the Tasks list. Harmless on
  // touch, so it's only attached on keyboard devices.
  useEffect(() => {
    if (!keyboard) return;

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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;

      if (datePickerOpen || moreOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeReschedule();
        }
        return;
      }

      // ⇧X = cancel. Keyed off code so it isn't confused with plain `x`.
      if (e.shiftKey && e.code === 'KeyX') {
        if (!current) return;
        e.preventDefault();
        haptic('tap');
        onCancel(current.id);
        advance();
        return;
      }

      switch (e.key) {
        case 'x':
        case 'Enter':
          if (!current) break;
          e.preventDefault();
          haptic('tap');
          onComplete(current.id);
          advance();
          break;
        case 'd':
          if (!current) break;
          e.preventDefault();
          openReschedule();
          break;
        case ' ':
        case 'ArrowRight':
        case 'j':
          e.preventDefault();
          haptic('tap');
          advance();
          break;
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // `advance` closes over index/tasks.length; re-subscribe as those change.
  }, [keyboard, datePickerOpen, moreOpen, current, index, tasks.length, onComplete, onCancel, onExit]);

  if (!current) {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-4xl">🎯</p>
        <p className="text-lg font-semibold text-slate-100">All triaged</p>
        <p className="text-sm text-slate-500">Nothing left to replan.</p>
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

  const cat = current.category ?? 'NO_DATE';

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit replan"
          className="text-sm text-slate-500 hover:text-slate-200"
        >
          ✕ Exit{keyboard && <span className="ml-1 text-slate-600">esc</span>}
        </button>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {index + 1} of {tasks.length}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-base text-slate-100">{current.text}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span className={CATEGORY_TONE[cat]}>{CATEGORY_LABEL[cat]}</span>
          {current.project && <span className="text-slate-500">· {current.project}</span>}
          {current.est && <span className="text-slate-500">· {current.est}</span>}
          {current.is_routine && <span className="text-slate-500">· 🔁</span>}
        </div>
      </div>

      {typedReschedule ? (
        <TypedDateBar
          onPick={(date) => {
            onReschedule(current.id, date);
            closeReschedule();
            advance();
          }}
          onClose={closeReschedule}
          onMore={() => {
            setDatePickerOpen(false);
            setMoreOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ActionButton
            tone="emerald"
            hint={keyboard ? 'X' : undefined}
            onClick={() => {
              haptic('tap');
              onComplete(current.id);
              advance();
            }}
          >
            ✓ Done
          </ActionButton>
          <ActionButton
            tone="slate"
            hint={keyboard ? 'D' : undefined}
            onClick={() => {
              haptic('tap');
              openReschedule();
            }}
          >
            Reschedule
          </ActionButton>
          <ActionButton
            tone="rose"
            hint={keyboard ? '⇧X' : undefined}
            onClick={() => {
              haptic('tap');
              onCancel(current.id);
              advance();
            }}
          >
            ✕ Cancel task
          </ActionButton>
          <ActionButton
            tone="ghost"
            hint={keyboard ? '␣' : undefined}
            onClick={() => {
              haptic('tap');
              advance();
            }}
          >
            Skip →
          </ActionButton>
        </div>
      )}

      {/* Touch opens the sheet directly; keyboard starts with the typed bar
          and reaches the sheet via tab. */}
      <DateSheet
        open={(datePickerOpen && !keyboard) || moreOpen}
        taskTitle={current.text}
        currentDue={current.due}
        onClose={closeReschedule}
        onPick={(date) => {
          onReschedule(current.id, date);
          closeReschedule();
          advance();
        }}
      />
    </section>
  );
}

function ActionButton({
  children,
  tone,
  hint,
  onClick,
}: {
  children: React.ReactNode;
  tone: 'emerald' | 'slate' | 'rose' | 'ghost';
  hint?: string;
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
      className={`relative rounded-xl py-3 text-base font-medium transition active:scale-95 ${colors}`}
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
