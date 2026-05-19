import { useEffect, useState } from 'react';
import { haptic } from '../lib/haptic';
import { kolkataDateString, shiftKolkataDate } from '../lib/time';

interface Props {
  open: boolean;
  taskTitle?: string;
  currentDue?: string | null;
  onClose: () => void;
  onPick: (date: string | null) => void;
  onCancel?: () => void;
}

export function DateSheet({
  open,
  taskTitle,
  currentDue,
  onClose,
  onPick,
  onCancel,
}: Props) {
  const [customDate, setCustomDate] = useState<string>('');

  // Seed the date input with the task's current due date each time the sheet
  // opens so the user is editing-in-place rather than picking from a blank.
  useEffect(() => {
    if (open) setCustomDate(currentDue ?? '');
  }, [open, currentDue]);

  if (!open) return null;

  const now = new Date();
  const today = kolkataDateString(now);
  const tomorrow = shiftKolkataDate(now, 1);
  const oneWeek = shiftKolkataDate(now, 7);

  function pick(date: string | null) {
    haptic('tap');
    onPick(date);
    setCustomDate('');
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
        aria-label="Reschedule task"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-800 bg-slate-950 p-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        {taskTitle && (
          <p className="mb-1 truncate text-[10px] uppercase tracking-wider text-slate-500">
            {taskTitle}
          </p>
        )}
        <p className="mb-4 text-sm font-semibold text-slate-100">Reschedule</p>

        <div className="flex flex-wrap gap-2">
          <Chip
            label="Today"
            active={currentDue === today}
            onClick={() => pick(today)}
          />
          <Chip
            label="Tomorrow"
            active={currentDue === tomorrow}
            onClick={() => pick(tomorrow)}
          />
          <Chip label="+1 week" onClick={() => pick(oneWeek)} />
          {currentDue && (
            <Chip label="Clear date" tone="rose" onClick={() => pick(null)} />
          )}
        </div>

        <label className="mt-5 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Or pick a date
          </span>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="button"
              disabled={!customDate}
              onClick={() => pick(customDate)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-50 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Set
            </button>
          </div>
        </label>

        {onCancel && (
          <div className="mt-5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => {
                haptic('warning');
                onCancel();
              }}
              className="w-full rounded-xl border border-rose-700/60 bg-rose-900/20 px-4 py-2 text-sm font-medium text-rose-200 transition active:scale-95 hover:border-rose-500"
            >
              Cancel task
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Chip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active?: boolean;
  tone?: 'rose';
  onClick: () => void;
}) {
  const base =
    'rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95';
  const variant =
    tone === 'rose'
      ? 'border-rose-700/60 bg-rose-900/20 text-rose-200 hover:border-rose-500'
      : active
        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500';
  return (
    <button type="button" onClick={onClick} className={`${base} ${variant}`}>
      {label}
    </button>
  );
}
