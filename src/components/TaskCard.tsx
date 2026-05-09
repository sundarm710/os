import { type ReactNode } from 'react';
import { type Task, type TaskCategory } from '../lib/api';
import { haptic } from '../lib/haptic';
import { formatDayLabel } from '../lib/time';

interface Props {
  task: Task;
  muted?: boolean;
  hideProject?: boolean;
  onComplete?: (id: string) => void;
  onReschedule?: (id: string) => void;
}

export function TaskCard({
  task,
  muted,
  hideProject,
  onComplete,
  onReschedule,
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

  const checkable = !muted && Boolean(onComplete);

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
          aria-label={muted ? 'Completed' : 'Mark as done'}
          aria-pressed={muted}
          disabled={!checkable}
          onClick={() => {
            if (!checkable || !onComplete) return;
            haptic('tap');
            onComplete(task.id);
          }}
          className={[
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition active:scale-90',
            muted
              ? 'border-emerald-700/60 bg-emerald-700/30 text-emerald-200'
              : checkable
                ? 'border-slate-600 bg-slate-950 hover:border-emerald-400 hover:bg-emerald-400/5'
                : 'border-slate-700 bg-slate-950 opacity-60',
          ].join(' ')}
        >
          {muted && <span className="text-[12px] leading-none">✓</span>}
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
