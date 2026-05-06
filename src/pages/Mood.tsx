import { useEffect, useState } from 'react';
import { type MoodPayload } from '../lib/api';
import { haptic } from '../lib/haptic';
import { readString, writeString } from '../lib/storage';
import { formatRelative } from '../lib/time';
import { useSubmission } from '../lib/useSubmission';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

type Rating = MoodPayload['rating'];

const EMOJIS: { rating: Rating; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😞', label: 'Awful' },
  { rating: 2, emoji: '😕', label: 'Low' },
  { rating: 3, emoji: '😐', label: 'Meh' },
  { rating: 4, emoji: '🙂', label: 'Good' },
  { rating: 5, emoji: '😄', label: 'Great' },
];

export default function Mood() {
  const [selected, setSelected] = useState<Rating | null>(null);
  const [note, setNote] = useState('');
  const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null);
  const [_tick, setTick] = useState(0);

  const { status, error, submit } = useSubmission<MoodPayload>('mood');

  useEffect(() => {
    setLastLoggedAt(readString('moodLastLoggedAt'));
  }, []);

  // Re-render once a minute so "5 min ago" stays current.
  useEffect(() => {
    if (!lastLoggedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [lastLoggedAt]);

  const canSubmit = selected !== null && status !== 'sending';

  function pick(rating: Rating) {
    haptic('tap');
    setSelected(rating);
  }

  async function handleSubmit() {
    if (!canSubmit || selected === null) return;
    const ts = new Date().toISOString();
    await submit(() => ({
      rating: selected,
      note: note.trim() || null,
      client_timestamp: ts,
    }));
    writeString('moodLastLoggedAt', ts);
    setLastLoggedAt(ts);
    setNote('');
    setSelected(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="How are you?"
        subtitle="Pick an emoji, add a note if you want, then submit."
        meta={
          lastLoggedAt
            ? `Last logged ${formatRelative(new Date(lastLoggedAt))}`
            : null
        }
      />

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
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
          }}
          placeholder="One line, if anything"
          maxLength={200}
          enterKeyHint="send"
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
        />
      </label>

      <SubmitButton
        label="Submit"
        onSubmit={() => void handleSubmit()}
        disabled={!canSubmit}
        status={status}
        error={error}
      />

      <StatusLine status={status} sentLabel="Logged ✓" />
    </section>
  );
}
