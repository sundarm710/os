import { type ReactNode, useRef } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { formatDayLabel } from '../lib/time';

const LONG_PRESS_MS = 500;

interface Props {
  task: Task;
  muted?: boolean;
  hideProject?: boolean;
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onReopen?: (id: string) => void;
  onReschedule?: (id: string) => void;
  /** Open the Calendar tab prefilled with this task. */
  onSchedule?: (task: Task) => void;
}

export function TaskCard({
  task,
  muted,
  hideProject,
  onComplete,
  onStart,
  onReopen,
  onReschedule,
  onSchedule,
}: Props) {
  const meta: ReactNode[] = [];

  if (!hideProject && task.project) {
    meta.push(<span key="project">{task.project}</span>);
  }
  // The due chip itself is the reschedule affordance — tapping the date opens
  // the date sheet. Dateless open tasks get a "+ date" pill so the trigger is
  // still discoverable. The chip's color encodes urgency (rose=overdue,
  // emerald=today) so project-grouped mode doesn't need a separate badge.
  if (!muted && onReschedule) {
    meta.push(
      <button
        key="due"
        type="button"
        onClick={() => {
          haptic('tap');
          onReschedule(task.id);
        }}
        className={[
          'border-b border-dashed transition',
          dueChipTone(task.category, Boolean(task.due)),
        ].join(' ')}
      >
        {task.due ? formatDueLabel(task.due) : '+ date'}
      </button>,
    );
  } else if (task.due) {
    meta.push(<span key="due">{formatDueLabel(task.due)}</span>);
  }
  if (task.est) {
    meta.push(<span key="est">{task.est}</span>);
  }

  // Scheduled badge: present iff pm_headless extracted an ⏳ field. When time
  // is present we show it; otherwise just the date. Tapping re-opens the
  // Calendar prefilled — re-scheduling overwrites the ⏳ stamp (a stale GCal
  // event from the previous schedule is the known gap noted in the plan).
  if (task.scheduled_at) {
    const [schedDate, schedTime] = task.scheduled_at.split('T');
    const label = schedTime ? `📅 ${schedTime}` : `📅 ${formatDueLabel(schedDate)}`;
    if (!muted && onSchedule) {
      meta.push(
        <button
          key="sched"
          type="button"
          onClick={() => {
            haptic('tap');
            onSchedule(task);
          }}
          className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-1.5 py-0 text-emerald-200 transition hover:border-emerald-400"
        >
          {label}
        </button>,
      );
    } else {
      meta.push(
        <span key="sched" className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-1.5 py-0 text-emerald-200">
          {label}
        </span>,
      );
    }
  } else if (!muted && onSchedule) {
    meta.push(
      <button
        key="sched"
        type="button"
        aria-label="Schedule on calendar"
        onClick={() => {
          haptic('tap');
          onSchedule(task);
        }}
        className="border-b border-dashed border-slate-700 text-slate-500 transition hover:border-emerald-400 hover:text-emerald-300"
      >
        📅
      </button>,
    );
  }

  const checkable = !muted && Boolean(onComplete);
  const reopenable = Boolean(muted) && Boolean(onReopen);
  const interactive = checkable || reopenable;
  const inProgress = task.status === 'in_progress';
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef<boolean>(false);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!checkable || !onStart || inProgress) return;
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      haptic('submitStart');
      onStart(task.id);
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (longPressFired.current) {
      // Long-press already fired — swallow the trailing click so we don't
      // also mark it done.
      longPressFired.current = false;
      return;
    }
    clearLongPress();
    if (reopenable && onReopen) {
      haptic('tap');
      onReopen(task.id);
      return;
    }
    if (!checkable || !onComplete) return;
    haptic('tap');
    onComplete(task.id);
  };

  return (
    <li
      className={[
        'rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2',
        muted ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={
            muted
              ? reopenable
                ? 'Reopen task'
                : 'Completed'
              : inProgress
                ? 'In progress — tap to complete'
                : 'Mark as done — long press to start'
          }
          aria-pressed={muted}
          disabled={!interactive}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(e) => e.preventDefault()}
          className={[
            'mt-0.5 flex h-5 w-5 shrink-0 select-none items-center justify-center rounded border transition active:scale-90',
            muted
              ? reopenable
                ? 'border-emerald-700/60 bg-emerald-700/30 text-emerald-200 hover:border-slate-400 hover:bg-slate-700/40'
                : 'border-emerald-700/60 bg-emerald-700/30 text-emerald-200'
              : inProgress
                ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                : checkable
                  ? 'border-slate-600 bg-slate-950 hover:border-emerald-400 hover:bg-emerald-400/5'
                  : 'border-slate-700 bg-slate-950 opacity-60',
          ].join(' ')}
        >
          {muted && <span className="text-[12px] leading-none">✓</span>}
          {!muted && inProgress && (
            <span className="text-[12px] font-bold leading-none">/</span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className={[
                'flex-1 text-sm line-clamp-2',
                muted
                  ? 'text-slate-400 line-through decoration-slate-600'
                  : 'text-slate-200',
              ].join(' ')}
            >
              {task.text}
            </p>
            {task.is_routine && (
              <span aria-label="Routine" className="shrink-0 text-xs leading-none">
                🔁
              </span>
            )}
          </div>
          {meta.length > 0 && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
              {meta}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function formatDueLabel(due: string): string {
  // Parse YYYY-MM-DD as midnight in IST so the relative label aligns with the
  // user's wall-clock day, not UTC.
  const date = new Date(`${due}T00:00:00+05:30`);
  return formatDayLabel(date);
}

function dueChipTone(category: TaskCategory | undefined, hasDue: boolean): string {
  if (category === 'OVERDUE') {
    return 'border-rose-700/60 text-rose-300 hover:border-rose-400 hover:text-rose-200';
  }
  if (category === 'TODAY') {
    return 'border-emerald-700/60 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200';
  }
  return hasDue
    ? 'border-slate-700 text-slate-400 hover:border-emerald-400 hover:text-emerald-200'
    : 'border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-300';
}
