import { useEffect, useState } from 'react';
import { type PartnerPerson } from '../lib/api';
import { haptic } from '../lib/haptic';

interface Props {
  open: boolean;
  you: PartnerPerson | null;
  onClose: () => void;
  onAdd: (text: string, assignee: PartnerPerson | null) => Promise<void>;
}

const PERSON_LABEL: Record<PartnerPerson, string> = { sundar: 'Sundar', partner: 'Partner' };

export function AddPartnerTaskSheet({ open, you, onClose, onAdd }: Props) {
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState<PartnerPerson | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setAssignee(null);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = text.trim();
  const canSubmit = !submitting && trimmed.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    haptic('submitStart');
    try {
      await onAdd(trimmed, assignee);
      haptic('successRamp');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const other: PartnerPerson | null = you === 'sundar' ? 'partner' : you === 'partner' ? 'sundar' : null;

  return (
    <>
      <div role="presentation" onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label="New shared task"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">New task</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-200">
            ✕
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
          }}
          placeholder="What needs doing?"
          maxLength={280}
          enterKeyHint="send"
          autoCapitalize="sentences"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Assign to</span>
          <div className="flex flex-wrap gap-2">
            <Chip label="Either" active={assignee === null} onClick={() => setAssignee(null)} />
            {you && <Chip label="Me" active={assignee === you} onClick={() => setAssignee(you)} />}
            {other && (
              <Chip label={PERSON_LABEL[other]} active={assignee === other} onClick={() => setAssignee(other)} />
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-emerald-50 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          {submitting ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition active:scale-95',
        active
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
