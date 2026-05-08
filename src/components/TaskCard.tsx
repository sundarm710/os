import { type Task } from '../lib/api';
import { formatDayLabel } from '../lib/time';

interface Props {
  task: Task;
  muted?: boolean;
}

export function TaskCard({ task, muted }: Props) {
  const meta: string[] = [];
  if (task.project) meta.push(task.project);
  if (task.due) meta.push(formatDueLabel(task.due));
  if (task.est) meta.push(task.est);

  return (
    <li
      className={[
        'rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2',
        muted ? 'opacity-60' : '',
      ].join(' ')}
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
          <span
            aria-label="Routine"
            className="shrink-0 text-xs leading-none"
          >
            🔁
          </span>
        )}
      </div>
      {meta.length > 0 && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      )}
    </li>
  );
}

function formatDueLabel(due: string): string {
  // Parse YYYY-MM-DD as midnight in IST so the relative label aligns with the
  // user's wall-clock day, not UTC.
  const date = new Date(`${due}T00:00:00+05:30`);
  return formatDayLabel(date);
}
