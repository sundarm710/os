import { useEffect, useState } from 'react';
import { postMood, type MoodPayload } from '../lib/api';

const EMOJIS: { rating: MoodPayload['rating']; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😞', label: 'Awful' },
  { rating: 2, emoji: '😕', label: 'Low' },
  { rating: 3, emoji: '😐', label: 'Meh' },
  { rating: 4, emoji: '🙂', label: 'Good' },
  { rating: 5, emoji: '😄', label: 'Great' },
];

type Status = 'idle' | 'sending' | 'sent' | 'error';

const LAST_LOGGED_KEY = 'mood:lastLoggedAt';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    // navigator.vibrate accepts number | number[] per spec; widen the lib type.
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

  useEffect(() => {
    const stored = localStorage.getItem(LAST_LOGGED_KEY);
    if (stored) setLastLoggedAt(stored);
  }, []);

  // Re-render the relative time once a minute so "5 min ago" stays current.
  useEffect(() => {
    if (!lastLoggedAt) return;
    const id = setInterval(() => setLastLoggedAt((v) => v), 60_000);
    return () => clearInterval(id);
  }, [lastLoggedAt]);

  const canSubmit = selected !== null && status !== 'sending';

  async function submit() {
    if (!canSubmit || selected === null) return;
    vibrate(15);
    setStatus('sending');
    setError(null);
    try {
      const ts = new Date().toISOString();
      await postMood({
        rating: selected,
        note: note.trim() || null,
        client_timestamp: ts,
      });
      localStorage.setItem(LAST_LOGGED_KEY, ts);
      setLastLoggedAt(ts);
      setStatus('sent');
      vibrate([15, 60, 15]);
      setNote('');
      setTimeout(() => {
        setStatus('idle');
        setSelected(null);
      }, 1500);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to send');
    }
  }

  function pick(rating: MoodPayload['rating']) {
    vibrate(10);
    setSelected(rating);
    if (status === 'error') {
      setStatus('idle');
      setError(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">How are you?</h1>
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
          <p className="text-sm text-rose-400">{error ?? 'Failed to send'}</p>
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
      </div>
    </section>
  );
}
