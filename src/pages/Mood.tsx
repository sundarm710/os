import { useEffect, useState } from 'react';
import { type MoodPayload } from '../lib/api';
import { enqueue, newClientId } from '../lib/queue';
import { drainQueue } from '../lib/sync';
import { usePendingQueue } from '../lib/usePendingQueue';

const EMOJIS: { rating: MoodPayload['rating']; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😞', label: 'Awful' },
  { rating: 2, emoji: '😕', label: 'Low' },
  { rating: 3, emoji: '😐', label: 'Meh' },
  { rating: 4, emoji: '🙂', label: 'Good' },
  { rating: 5, emoji: '😄', label: 'Great' },
];

type Status = 'idle' | 'sending' | 'sent' | 'queued' | 'error';

const LAST_LOGGED_KEY = 'mood:lastLoggedAt';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    (navigator.vibrate as (p: number | number[]) => boolean)(pattern);
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  const time = then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `today at ${time}` : `${then.toLocaleDateString()} ${time}`;
}

export default function Mood() {
  const [selected, setSelected] = useState<MoodPayload['rating'] | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null);

  const { pendingCount, stuckCount } = usePendingQueue();

  useEffect(() => {
    const stored = localStorage.getItem(LAST_LOGGED_KEY);
    if (stored) setLastLoggedAt(stored);
  }, []);

  useEffect(() => {
    if (!lastLoggedAt) return;
    const id = setInterval(() => setLastLoggedAt((v) => v), 60_000);
    return () => clearInterval(id);
  }, [lastLoggedAt]);

  const canSubmit = selected !== null && status !== 'sending';

  async function submit() {
    if (!canSubmit || selected === null) return;
    vibrate(30);
    setStatus('sending');
    setError(null);

    const payload: MoodPayload = {
      client_id: newClientId(),
      rating: selected,
      note: note.trim() || null,
      client_timestamp: new Date().toISOString(),
    };

    try {
      await enqueue('mood', payload);

      vibrate(40);
      const { sent, failed } = await drainQueue();

      if (failed === 0 && sent > 0) {
        localStorage.setItem(LAST_LOGGED_KEY, payload.client_timestamp);
        setLastLoggedAt(payload.client_timestamp);
        setStatus('sent');
        vibrate([60, 80, 120]);
      } else {
        setStatus('queued');
      }

      setNote('');
      setTimeout(() => {
        setStatus('idle');
        setSelected(null);
      }, 1500);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  function pick(rating: MoodPayload['rating']) {
    vibrate(30);
    setSelected(rating);
    if (status === 'error') {
      setStatus('idle');
      setError(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">How are you?</h1>
          <QueueBadge pendingCount={pendingCount} stuckCount={stuckCount} />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Pick an emoji, add a note if you want, then submit.
        </p>
        {lastLoggedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Last logged {formatRelative(lastLoggedAt)}
          </p>
        )}
      </header>

      <div className="grid grid-cols-5 gap-2">
        {EMOJIS.map(({ rating, emoji, label }) => {
          const isActive = selected === rating;
          return (
            <button
              key={rating}
              type="button"
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => pick(rating)}
              disabled={status === 'sending'}
              className={[
                'flex aspect-square items-center justify-center rounded-2xl border text-4xl transition active:scale-95',
                isActive
                  ? 'border-emerald-400 bg-emerald-400/10'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700',
              ].join(' ')}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Note (optional)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) submit();
          }}
          placeholder="One line, if anything"
          maxLength={200}
          enterKeyHint="send"
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
        />
      </label>

      {status === 'error' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-rose-400">{error ?? 'Could not save'}</p>
          <button
            type="button"
            onClick={submit}
            className="rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-slate-950 transition active:scale-[0.99] hover:bg-rose-400"
          >
            Retry
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={[
            'rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.99]',
            canSubmit
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              : 'bg-slate-800 text-slate-500',
          ].join(' ')}
        >
          {status === 'sending' ? 'Logging…' : 'Submit'}
        </button>
      )}

      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {status === 'sent' && <span className="text-emerald-400">Logged ✓</span>}
        {status === 'queued' && (
          <span className="text-amber-300">Saved — will sync</span>
        )}
      </div>
    </section>
  );
}

function QueueBadge({
  pendingCount,
  stuckCount,
}: {
  pendingCount: number;
  stuckCount: number;
}) {
  if (pendingCount === 0) return null;
  const isStuck = stuckCount > 0;
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-xs font-medium',
        isStuck
          ? 'bg-rose-500/20 text-rose-300'
          : 'bg-amber-500/20 text-amber-300',
      ].join(' ')}
      title={
        isStuck
          ? 'Stuck — failing to sync after multiple attempts'
          : 'Items waiting to sync'
      }
    >
      {pendingCount} {isStuck ? 'stuck' : 'pending'}
    </span>
  );
}
