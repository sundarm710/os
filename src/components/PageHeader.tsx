import type { ReactNode } from 'react';
import { usePendingQueue } from '../lib/usePendingQueue';
import { QueueBadge } from './QueueBadge';

type Props = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  action?: ReactNode;
};

// Page header with the live queue badge wired in. Pages should render this at
// the top of their section so the badge stays in a consistent position.
export function PageHeader({ title, subtitle, meta, action }: Props) {
  const { pendingCount, stuckCount } = usePendingQueue();

  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {action}
          <QueueBadge pendingCount={pendingCount} stuckCount={stuckCount} />
        </div>
      </div>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      {meta && <div className="mt-2 text-xs text-slate-500">{meta}</div>}
    </header>
  );
}
