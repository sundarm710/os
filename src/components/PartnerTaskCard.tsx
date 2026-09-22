import { type PartnerPerson, type PartnerTask } from '../lib/api';
import { haptic } from '../lib/haptic';

interface Props {
  task: PartnerTask;
  you: PartnerPerson | null;
  muted?: boolean;
  onComplete?: (id: string) => void;
  onReopen?: (id: string) => void;
}

const PERSON_LABEL: Record<PartnerPerson, string> = { sundar: 'Sundar', partner: 'Partner' };

function assigneeChipTone(assignee: PartnerPerson | null, you: PartnerPerson | null): string {
  if (assignee === null) return 'border-slate-700 text-slate-400';
  if (assignee === you) return 'border-emerald-700/60 text-emerald-300';
  return 'border-violet-700/60 text-violet-300';
}

export function PartnerTaskCard({ task, you, muted, onComplete, onReopen }: Props) {
  const interactive = muted ? Boolean(onReopen) : Boolean(onComplete);

  return (
    <li
      className={[
        'rounded-lg border bg-slate-900/60 px-3 py-2 transition',
        muted ? 'border-slate-800 opacity-60' : 'border-slate-800',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={muted ? 'Reopen task' : 'Mark as done'}
          disabled={!interactive}
          onClick={() => {
            if (!interactive) return;
            haptic('tap');
            if (muted) onReopen?.(task.id);
            else onComplete?.(task.id);
          }}
          className={[
            'mt-0.5 flex h-5 w-5 shrink-0 select-none items-center justify-center rounded border transition active:scale-90',
            muted
              ? 'border-emerald-700/60 bg-emerald-700/30 text-emerald-200 hover:border-slate-400 hover:bg-slate-700/40'
              : 'border-slate-600 bg-slate-950 hover:border-emerald-400 hover:bg-emerald-400/5',
          ].join(' ')}
        >
          {muted && <span className="text-[12px] leading-none">✓</span>}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={[
              'text-sm line-clamp-2',
              muted ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200',
            ].join(' ')}
          >
            {task.text}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span className={['rounded-full border px-1.5 py-0', assigneeChipTone(task.assignee, you)].join(' ')}>
              {task.assignee ? PERSON_LABEL[task.assignee] : 'Either'}
            </span>
            {muted && task.completed_by && (
              <span>done by {PERSON_LABEL[task.completed_by]}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
