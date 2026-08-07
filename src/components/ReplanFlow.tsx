import { useEffect, useState } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { resolveDueToken } from '../lib/taskInput';
import { formatDayLabelLong } from '../lib/time';
import { DateSheet } from './DateSheet';

function parseISTDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`);
}

interface Props {
  tasks: Task[];
  /** Desktop only — enable single-key triage (x/d/s/esc) + show key hints. */
  keyboard?: boolean;
  onComplete: (id: string | null) => void;
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
  onReschedule,
  onExit,
}: Props) {
  const [index, setIndex] = useState<number>(0);
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const [dateText, setDateText] = useState<string>('');
  const current: Task | undefined = tasks[index];

  // On keyboard devices, "Reschedule" swaps the action buttons for an inline
  // typed date bar (@tomorrow / fri / 3d / 2026-08-05). Touch keeps the sheet.
  const typedReschedule = Boolean(keyboard) && datePickerOpen;

  function openReschedule() {
    setDateText('');
    setDatePickerOpen(true);
  }

  function closeReschedule() {
    setDatePickerOpen(false);
    setDateText('');
  }

  function advance() {
    if (index + 1 >= tasks.length) {
      onExit();
    } else {
      setIndex((i) => i + 1);
    }
  }

  // Resolve the typed date live for the preview (leading '@' optional).
  const resolvedDate = dateText.trim()
    ? resolveDueToken(dateText.trim().replace(/^@/, ''), new Date())
    : null;

  // Single-key triage. While the date sheet is open its own inputs own the
  // keyboard (Esc closes it); otherwise x=done, d=reschedule, s/→/space=skip,
  // esc=exit. Harmless on touch, so it's only attached on keyboard devices.
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

      if (datePickerOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setDatePickerOpen(false);
        }
        return;
      }

      switch (e.key) {
        case 'x':
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
        case 's':
        case 'ArrowRight':
        case ' ':
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
  }, [keyboard, datePickerOpen, current, index, tasks.length, onComplete, onExit]);

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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-slate-900 px-3 py-2.5">
            <span className="select-none text-sm text-slate-500">@</span>
            <input
              autoFocus
              type="text"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (resolvedDate) {
                    haptic('tap');
                    onReschedule(current.id, resolvedDate);
                    closeReschedule();
                    advance();
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeReschedule();
                }
              }}
              placeholder="tomorrow · fri · 3d · 2w · 2026-08-05"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={closeReschedule}
              className="text-[11px] text-slate-600 hover:text-slate-300"
            >
              esc
            </button>
          </div>
          <div className="px-1 text-[11px]">
            {dateText.trim() === '' ? (
              <span className="text-slate-600">
                Type a date, ↵ to reschedule · esc to cancel
              </span>
            ) : resolvedDate ? (
              <span className="text-emerald-300">
                → {formatDayLabelLong(parseISTDate(resolvedDate))}
                <span className="ml-1 text-slate-600">↵</span>
              </span>
            ) : (
              <span className="text-rose-400">unrecognised date</span>
            )}
          </div>
        </div>
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
            tone="ghost"
            hint={keyboard ? 'S' : undefined}
            onClick={() => {
              haptic('tap');
              advance();
            }}
          >
            Skip →
          </ActionButton>
        </div>
      )}

      {/* Touch devices keep the bottom sheet; keyboard uses the inline bar. */}
      <DateSheet
        open={datePickerOpen && !keyboard}
        taskTitle={current.text}
        currentDue={current.due}
        onClose={() => setDatePickerOpen(false)}
        onPick={(date) => {
          onReschedule(current.id, date);
          setDatePickerOpen(false);
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
  tone: 'emerald' | 'slate' | 'ghost';
  hint?: string;
  onClick: () => void;
}) {
  const colors =
    tone === 'emerald'
      ? 'bg-emerald-500 text-emerald-50 hover:bg-emerald-400'
      : tone === 'slate'
        ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600'
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
