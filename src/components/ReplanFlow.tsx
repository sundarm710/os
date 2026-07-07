import { useState } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { DateSheet } from './DateSheet';

interface Props {
  tasks: Task[];
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

export function ReplanFlow({ tasks, onComplete, onReschedule, onExit }: Props) {
  const [index, setIndex] = useState<number>(0);
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const current: Task | undefined = tasks[index];

  function advance() {
    if (index + 1 >= tasks.length) {
      onExit();
    } else {
      setIndex((i) => i + 1);
    }
  }

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
          ✕ Exit
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

      <div className="flex flex-col gap-3">
        <ActionButton
          tone="emerald"
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
          onClick={() => {
            haptic('tap');
            setDatePickerOpen(true);
          }}
        >
          Reschedule
        </ActionButton>
        <ActionButton
          tone="ghost"
          onClick={() => {
            haptic('tap');
            advance();
          }}
        >
          Skip →
        </ActionButton>
      </div>

      <DateSheet
        open={datePickerOpen}
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
  onClick,
}: {
  children: React.ReactNode;
  tone: 'emerald' | 'slate' | 'ghost';
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
      className={`rounded-xl py-3 text-base font-medium transition active:scale-95 ${colors}`}
    >
      {children}
    </button>
  );
}
