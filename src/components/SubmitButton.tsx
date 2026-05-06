import type { SubmissionStatus } from '../lib/useSubmission';

type Props = {
  label: string;
  onSubmit: () => void;
  disabled?: boolean;
  status: SubmissionStatus;
  error?: string | null;
  onRetry?: () => void;
};

// Unified submit button + error/retry surface so capture pages stay focused on
// their feature-specific UI.
export function SubmitButton({
  label,
  onSubmit,
  disabled = false,
  status,
  error,
  onRetry,
}: Props) {
  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-rose-400">{error ?? 'Could not save'}</p>
        <button
          type="button"
          onClick={onRetry ?? onSubmit}
          className="rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-slate-950 transition active:scale-[0.99] hover:bg-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  const enabled = !disabled && status !== 'sending';

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!enabled}
      className={[
        'rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.99]',
        enabled
          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
          : 'bg-slate-800 text-slate-500',
      ].join(' ')}
    >
      {status === 'sending' ? 'Saving…' : label}
    </button>
  );
}
