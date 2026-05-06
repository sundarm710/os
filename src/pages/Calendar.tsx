import { useState } from 'react';
import { type CalendarPayload } from '../lib/api';
import { haptic } from '../lib/haptic';
import { readString, writeString } from '../lib/storage';
import {
  addMinutes,
  formatForGCal,
  formatTime,
  nextQuarterHour,
  snapToQuarterHour,
} from '../lib/time';
import { useSubmission } from '../lib/useSubmission';
import { DialRow } from '../components/DialRow';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

// 3x3 grid laid out by daily-life cluster, not alphabetised. Edit this array
// to change visible chips — the type derives from it.
const TITLE_ROWS = [
  ['Amrutha', 'Build', 'Workout'],
  ['Chess', 'German', 'Admin'],
  ['Chill', 'Sleep', 'Chores'],
] as const;

type Title = (typeof TITLE_ROWS)[number][number];

const ALL_TITLES = TITLE_ROWS.flat() as readonly Title[];
const DEFAULT_TITLE: Title = 'Build';
const DEFAULT_DURATION_MIN = 15;
const STEP_MIN = 15;
const TIMEZONE = 'Asia/Kolkata';

function isTitle(v: string | null): v is Title {
  return v !== null && (ALL_TITLES as readonly string[]).includes(v);
}

function initialTitle(): Title {
  const stored = readString('calendarLastTitle');
  return isTitle(stored) ? stored : DEFAULT_TITLE;
}

export default function Calendar() {
  const [title, setTitle] = useState<Title>(initialTitle);
  const [start, setStart] = useState<Date>(() => nextQuarterHour(new Date()));
  const [durationMin, setDurationMin] = useState<number>(DEFAULT_DURATION_MIN);

  const { status, error, submit } = useSubmission<CalendarPayload>('calendar');

  const end = addMinutes(start, durationMin);
  const isSending = status === 'sending';

  function pickTitle(next: Title) {
    haptic('tap');
    setTitle(next);
  }

  function stepStart(direction: 1 | -1) {
    setStart((prev) => snapToQuarterHour(addMinutes(prev, direction * STEP_MIN)));
  }

  function stepDuration(direction: 1 | -1) {
    setDurationMin((prev) => Math.max(STEP_MIN, prev + direction * STEP_MIN));
  }

  async function handleSubmit() {
    if (isSending) return;
    await submit(() => ({
      title,
      start_time: formatForGCal(start, TIMEZONE),
      end_time: formatForGCal(end, TIMEZONE),
      timezone: TIMEZONE,
    }));
    writeString('calendarLastTitle', title);
    setStart(nextQuarterHour(end));
    setDurationMin(DEFAULT_DURATION_MIN);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Calendar Block"
        subtitle="Tap title, drag to adjust, submit."
      />

      <div className="flex flex-col gap-2">
        {TITLE_ROWS.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2">
            {row.map((t) => {
              const isActive = title === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => pickTitle(t)}
                  disabled={isSending}
                  className={[
                    'rounded-full border px-3 py-2 text-sm font-medium transition active:scale-95',
                    isActive
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
                  ].join(' ')}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <DialRow
        label="Start"
        value={formatTime(start)}
        onStep={stepStart}
        disabled={isSending}
      />

      <DialRow
        label="Duration"
        value={`${durationMin} min`}
        onStep={stepDuration}
        canDecrement={durationMin > STEP_MIN}
        disabled={isSending}
      />

      <p className="text-xs text-slate-500">
        Ends at {formatTime(end)} · {TIMEZONE}
      </p>

      <SubmitButton
        label="Schedule"
        onSubmit={() => void handleSubmit()}
        disabled={isSending}
        status={status}
        error={error}
      />

      <StatusLine
        status={status}
        sentLabel="Scheduled ✓"
        queuedLabel="Saved — will sync"
      />
    </section>
  );
}
