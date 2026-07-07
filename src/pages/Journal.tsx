import React, { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { fetchJournalLogs, type JournalLog, type JournalPayload } from '../lib/api';
import { haptic } from '../lib/haptic';
import { readString, writeString } from '../lib/storage';
import { formatRelative } from '../lib/time';
import { useSubmission } from '../lib/useSubmission';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

type Rating = 1 | 2 | 3 | 4 | 5;

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function renderWikiText(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const note = match[1];
    const display = match[2] ?? match[1];
    const href = `obsidian://open?vault=sundar-vault&file=${encodeURIComponent(note)}`;
    parts.push(
      <a
        key={match.index}
        href={href}
        onClick={e => e.stopPropagation()}
        className="inline-block rounded-full border border-teal-700 bg-teal-900/40 px-2 py-0.5 text-xs font-medium text-teal-300 no-underline hover:border-teal-500 hover:text-teal-100 active:scale-95"
      >
        {display}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

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
  { label: 'Amrutha', prefix: 'Amrutha: ' },
  { label: 'TIL', prefix: 'TIL: ' },
  { label: "What I'm Upto", prefix: "What I'm Upto: " },
  { label: 'Quote', prefix: 'Quote: ' },
  { label: 'Bucket list', prefix: 'Bucket list: ' },
];

type LogCategory = 'all' | 'highlights' | 'lowlights' | 'feeling' | 'amrutha' | 'bucket';

const CATEGORIES: { id: LogCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'lowlights', label: 'Lowlights' },
  { id: 'feeling', label: 'Feeling' },
  { id: 'amrutha', label: 'Amrutha' },
  { id: 'bucket', label: 'Bucket' },
];

// Single-select tab filter; "all" returns true.
// Highlights/Lowlights are mood-based; Feeling/Amrutha are keyword-based.
function matchesCategory(log: JournalLog, cat: LogCategory): boolean {
  if (cat === 'all') return true;
  if (cat === 'highlights') return log.mood != null && log.mood >= 4;
  if (cat === 'lowlights') return log.mood != null && log.mood <= 2;
  const t = log.text ?? '';
  if (cat === 'amrutha') return /amrutha/i.test(t);
  if (cat === 'feeling') return /(^|\s)feeling[:\s]/i.test(t);
  if (cat === 'bucket') return /bucket\s*list/i.test(t);
  return true;
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { status, error, submit } = useSubmission<JournalPayload>('journal');

  const [logs, setLogs] = useState<JournalLog[]>([]);
  const [logsState, setLogsState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [logsError, setLogsError] = useState<string | null>(null);

  // When set, submit() upserts that journal_logs row instead of inserting new.
  const [editing, setEditing] = useState<JournalLog | null>(null);

  const [category, setCategory] = useState<LogCategory>('all');

  const loadLogs = useCallback(async () => {
    setLogsState('loading');
    setLogsError(null);
    try {
      const rows = await fetchJournalLogs({ limit: 50 });
      setLogs(rows);
      setLogsState('idle');
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : 'failed to load');
      setLogsState('error');
    }
  }, []);

  useEffect(() => {
    setLastLoggedAt(readString('journalLastLoggedAt'));
    void loadLogs();
  }, [loadLogs]);

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
    const editingRow = editing;
    if (editingRow) {
      // Edit path — reuse client_id + preserve original client_timestamp so
      // entry_date/entry_time on the row don't drift. The server UPSERTs by
      // client_id (text + mood update; date columns are write-once).
      await submit(() => ({
        client_id: editingRow.client_id,
        client_timestamp: editingRow.client_timestamp,
        text: composed,
      }));
    } else {
      await submit(() => ({
        client_timestamp: ts,
        text: composed,
      }));
      writeString('journalLastLoggedAt', ts);
      setLastLoggedAt(ts);
    }
    setText('');
    setRating(null);
    setEditing(null);
    setPlaceholder(pickPlaceholder());
    void loadLogs();
  }

  function loadIntoForm(log: JournalLog) {
    haptic('tap');
    setEditing(log);
    setText(log.text);
    setRating(
      log.mood != null && log.mood >= 1 && log.mood <= 5 ? (log.mood as Rating) : null,
    );
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function cancelEdit() {
    setEditing(null);
    setText('');
    setRating(null);
  }

  // 500ms hold on a log row opens edit mode. We track the timer per-pointer
  // and cancel on any movement >10px so list scrolling never triggers an edit.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  }
  function longPressBindings(log: JournalLog) {
    return {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pressStart.current = { x: e.clientX, y: e.clientY };
        pressTimer.current = setTimeout(() => {
          pressTimer.current = null;
          loadIntoForm(log);
        }, 500);
      },
      onPointerMove: (e: ReactPointerEvent) => {
        if (!pressStart.current) return;
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (dx * dx + dy * dy > 100) clearPress();
      },
      onPointerUp: clearPress,
      onPointerCancel: clearPress,
      onPointerLeave: clearPress,
      onContextMenu: (e: ReactMouseEvent) => {
        // Prevent the iOS long-press text selection menu from swallowing our gesture.
        e.preventDefault();
      },
    };
  }

  function moodEmoji(m: number | null): string {
    if (m == null) return '';
    if (m <= 1) return '😞';
    if (m === 2) return '😕';
    if (m === 3) return '😐';
    if (m === 4) return '🙂';
    return '😄';
  }

  function formatLogTimestamp(log: JournalLog): string {
    // entry_date is UTC midnight from Postgres; entry_time is IST wall-clock.
    // Render as "May 17 · 16:36" using those raw IST values.
    try {
      const d = new Date(log.entry_date);
      const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const day = d.getUTCDate();
      const time = (log.entry_time || '').slice(0, 5);
      return `${month} ${day} · ${time}`;
    } catch {
      return log.entry_time?.slice(0, 5) ?? '';
    }
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
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {editing ? 'Editing entry' : 'Bullet Journal'}
          </span>
          {editing && (
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <span>{formatLogTimestamp(editing)}</span>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter submits; bare Enter inserts a newline.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          maxLength={2000}
          rows={4}
          enterKeyHint="enter"
          autoComplete="off"
          autoCapitalize="sentences"
          className="resize-y rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
        />
        <div className="flex justify-end text-xs text-slate-500">
          {text.length}/2000
        </div>

        <SubmitButton
          label={editing ? 'Update' : 'Submit'}
          onSubmit={() => void handleSubmit()}
          disabled={!canSubmit}
          status={status}
          error={error}
        />

        <StatusLine status={status} sentLabel="Logged ✓" />

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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Recent logs
          </span>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={logsState === 'loading'}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {logsState === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div
          role="tablist"
          aria-label="Log category"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {CATEGORIES.map((c) => {
            const count =
              c.id === 'all'
                ? logs.length
                : logs.filter((l) => matchesCategory(l, c.id)).length;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  haptic('tap');
                  setCategory(c.id);
                }}
                className={[
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition active:scale-95',
                  active
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700',
                ].join(' ')}
              >
                {c.label}
                <span className="ml-1.5 text-[10px] text-slate-500">{count}</span>
              </button>
            );
          })}
        </div>
        {logsState === 'error' && (
          <div className="text-xs text-rose-400">{logsError}</div>
        )}
        {logsState !== 'error' && logs.length === 0 && logsState !== 'loading' && (
          <div className="text-xs text-slate-500">No logs yet.</div>
        )}
        <ul className="flex flex-col gap-2">
          {logs.filter((log) => matchesCategory(log, category)).map((log) => {
            const isActive = editing?.client_id === log.client_id;
            return (
              <li
                key={log.client_id}
                {...longPressBindings(log)}
                className={[
                  'select-none rounded-xl border px-4 py-3 transition active:scale-[0.99]',
                  isActive
                    ? 'border-amber-400 bg-amber-400/5'
                    : 'border-slate-800 bg-slate-900/60',
                ].join(' ')}
                style={{ touchAction: 'pan-y', WebkitUserSelect: 'none' }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatLogTimestamp(log)}</span>
                  <div className="flex items-center gap-2">
                    {log.mood != null && (
                      <span aria-label={`mood ${log.mood}`}>{moodEmoji(log.mood)}</span>
                    )}
                    <button
                      type="button"
                      aria-label="Edit entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadIntoForm(log);
                      }}
                      className="rounded-md border border-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="mt-1 break-words text-sm leading-relaxed text-slate-200">
                  {renderWikiText(log.text ?? '')}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
