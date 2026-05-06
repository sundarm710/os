import type { SubmissionStatus } from '../lib/useSubmission';

type Props = {
  status: SubmissionStatus;
  sentLabel?: string;
  queuedLabel?: string;
};

export function StatusLine({
  status,
  sentLabel = 'Saved ✓',
  queuedLabel = 'Saved — will sync',
}: Props) {
  return (
    <div aria-live="polite" className="min-h-[1.5rem] text-sm">
      {status === 'sent' && <span className="text-emerald-400">{sentLabel}</span>}
      {status === 'queued' && <span className="text-amber-300">{queuedLabel}</span>}
    </div>
  );
}
