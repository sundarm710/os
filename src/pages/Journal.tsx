import { useEffect, useRef, useState } from 'react';
import { type JournalPayload } from '../lib/api';
import { haptic } from '../lib/haptic';
import { readString, writeString } from '../lib/storage';
import { formatRelative } from '../lib/time';
import { useSubmission } from '../lib/useSubmission';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

type Rating = 1 | 2 | 3 | 4 | 5;

const EMOJIS: { rating: Rating; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😞', label: 'Awful' },
  { rating: 2, emoji: '😕', label: 'Low' },
  { rating: 3, emoji: '😐', label: 'Meh' },
  { rating: 4, emoji: '🙂', label: 'Good' },
  { rating: 5, emoji: '😄', label: 'Great' },
];

const PROMPTS: { label: string; prefix: string }[] = [
  { label: 'On my mind', prefix: 'On my mind: ' },
  { label: 'Quick win', prefix: 'Quick win: ' },
  { label: 'Stuck on', prefix: 'Stuck on: ' },
  { label: 'Avoiding', prefix: 'Avoiding: ' },
  { label: 'Feeling', prefix: 'Feeling: ' },
  { label: 'Win', prefix: 'Win: ' },
  { label: 'Idea', prefix: 'Idea: ' },
  { label: 'Energy', prefix: 'Energy: ' },
  { label: 'To do', prefix: 'To do: ' },
  { label: 'Changed my mind on', prefix: 'Changed my mind on: ' },
  { label: 'Choices and consequences', prefix: 'Choices and consequences: ' },
  { label: 'Amrutha', prefix: 'Amrutha: ' },
  { label: 'TIL', prefix: 'TIL: ' },
  { label: "What I'm Upto", prefix: "What I'm Upto: " },
  { label: 'Quote', prefix: 'Quote: ' },
];

const PLACEHOLDERS = [
  "What's bouncing around in your head?",
  'Drop one line.',
  'Capture before you forget.',
  'Where is your head right now?',
  'One sentence is enough.',
  'Quick brain dump…',
  'What just happened?',
  'A thought, atomic.',
];

function pickPlaceholder(): string {
  const idx = Math.floor(Math.random() * PLACEHOLDERS.length);
  return PLACEHOLDERS[idx] ?? PLACEHOLDERS[0]!;
}

function composeText(rating: Rating | null, text: string): string {
  const trimmed = text.trim();
  if (rating === null) return trimmed;
  if (!trimmed) return `[mood: ${rating}]`;
  return `[mood: ${rating}] ${trimmed}`;
}

export default function Journal() {
  const [rating, setRating] = useState<Rating | null>(null);
  const [text, setText] = useState('');
  const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null);
  const [_tick, setTick] = useState(0);
  const [placeholder, setPlaceholder] = useState<string>(() => pickPlaceholder());
  const inputRef = useRef<HTMLInputElement>(null);

  const { status, error, submit } = useSubmission<JournalPayload>('journal');

  useEffect(() => {
    setLastLoggedAt(readString('journalLastLoggedAt'));
  }, []);

  // Re-render once a minute so the "Last logged" relative timestamp stays
  // current without polling on every render.
  useEffect(() => {
    if (!lastLoggedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [lastLoggedAt]);

  const composed = composeText(rating, text);
  const isSending = status === 'sending';
  const canSubmit = composed.length > 0 && !isSending;

  function pickRating(r: Rating) {
    haptic('tap');
    setRating((prev) => (prev === r ? null : r));
  }

  function applyPrompt(prefix: string) {
    haptic('tap');
    setText(prefix);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const ts = new Date().toISOString();
    await submit(() => ({
      client_timestamp: ts,
      text: composed,
    }));
    writeString('journalLastLoggedAt', ts);
    setLastLoggedAt(ts);
    setText('');
    setRating(null);
    setPlaceholder(pickPlaceholder());
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="How are you?"
        meta={
          lastLoggedAt
            ? `Last logged ${formatRelative(new Date(lastLoggedAt))}`
            : null
        }
      />

      <div className="grid grid-cols-5 gap-2">
        {EMOJIS.map(({ rating: r, emoji, label }) => {
          const isActive = rating === r;
          return (
            <button
              key={r}
              type="button"
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => pickRating(r)}
              disabled={isSending}
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

      <div className="flex flex-col gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Bullet Journal
        </span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
          }}
          placeholder={placeholder}
          maxLength={280}
          enterKeyHint="send"
          autoComplete="off"
          autoCapitalize="sentences"
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
        />
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map(({ label, prefix }) => {
            const isActive = text === prefix;
            return (
              <button
                key={label}
                type="button"
                onClick={() => applyPrompt(prefix)}
                disabled={isSending}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95',
                  isActive
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-slate-100',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

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
