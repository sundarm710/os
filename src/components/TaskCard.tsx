import { type ReactNode } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { formatDayLabelLong } from '../lib/time';
import { useLongPress } from '../lib/useLongPress';

interface Props {
  task: Task;
  muted?: boolean;
  hideProject?: boolean;
  onComplete?: (id: string | null) => void;
  onReopen?: (id: string | null) => void;
  onReschedule?: (id: string | null) => void;
  /** Long-press the card body, or tap the scheduled-time badge, to fire. */
  onSchedule?: (task: Task) => void;
}

export function TaskCard({
  task,
  muted,
  hideProject,
  onComplete,
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
        onPointerDown={stopPointerPropagation}
        onClick={() => {
          haptic('tap');
          onReschedule(task.id);
        }}
        className={[
          'border-b border-dashed transition',
          dueChipTone(task.category, Boolean(task.due)),
        ].join(' ')}
      >
        {task.due ? formatDayLabelLong(parseISTDate(task.due)) : '+ date'}
      </button>,
    );
  } else if (task.due) {
    meta.push(<span key="due">{formatDayLabelLong(parseISTDate(task.due))}</span>);
  }
  if (task.est) {
    meta.push(<span key="est">{task.est}</span>);
  }

  // Scheduled badge: present iff pm_headless extracted an ⏳ field. Tap to
  // re-open Calendar prefilled with the existing time (re-schedule). The
  // long-press path on the card body is the entry point for unscheduled
  // tasks, so we don't render a "+ schedule" pill when scheduled_at is null.
  if (task.scheduled_at) {
    const [schedDate, schedTime] = task.scheduled_at.split('T');
    const label = schedTime ? `📅 ${schedTime}` : `📅 ${formatDayLabelLong(parseISTDate(schedDate))}`;
    if (!muted && onSchedule) {
      meta.push(
        <button
          key="sched"
          type="button"
          onPointerDown={stopPointerPropagation}
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
        <span
          key="sched"
          className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-1.5 py-0 text-emerald-200"
        >
          {label}
        </span>,
      );
    }
  }

  const checkable = !muted && Boolean(onComplete);
  const reopenable = Boolean(muted) && Boolean(onReopen);
  const interactive = checkable || reopenable;
  const inProgress = task.status === 'in_progress';

  // Long-press the text-area (not the checkbox) to open Calendar prefilled.
  // Disabled when muted (done tasks shouldn't be rescheduled inline) or when
  // the consumer didn't wire onSchedule.
  const bodyPress = useLongPress({
    onLongPress:
      !muted && onSchedule
        ? () => {
            haptic('submitStart');
            onSchedule(task);
          }
        : undefined,
  });

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
                : 'Mark as done'
          }
          aria-pressed={muted}
          disabled={!interactive}
          onPointerDown={stopPointerPropagation}
          onClick={() => {
            if (reopenable && onReopen) {
              haptic('tap');
              onReopen(task.id);
              return;
            }
            if (!checkable || !onComplete) return;
            haptic('tap');
            onComplete(task.id);
          }}
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

        <div
          className="min-w-0 flex-1"
          style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
          {...bodyPress}
        >
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

// Stop a pointerdown from bubbling into the card body's long-press timer so
// tapping a chip or the checkbox doesn't also queue a schedule.
function stopPointerPropagation(e: React.PointerEvent) {
  e.stopPropagation();
}

// Parse YYYY-MM-DD as midnight IST so the relative label aligns with the
// user's wall-clock day, not UTC.
function parseISTDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`);
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
