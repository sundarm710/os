import { useEffect, useState } from 'react';
import { type CalendarPayload } from '../lib/api';
import { haptic } from '../lib/haptic';
import { readString, writeString } from '../lib/storage';
import {
  addMinutes,
  formatDateTime,
  formatForGCal,
  formatTime,
  nextQuarterHour,
  previousQuarterHour,
  snapToQuarterHour,
} from '../lib/time';
import { useCalendarEvents } from '../lib/useCalendarEvents';
import { useSubmission } from '../lib/useSubmission';
import { DialRow } from '../components/DialRow';
import { EventList } from '../components/EventList';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

const TITLE_ROWS = [
  ['Amrutha', 'Build', 'Workout'],
  ['Chess', 'German', 'Admin'],
  ['Chill', 'Sleep', 'Chores'],
] as const;

const DEFAULT_TITLE = 'Build';
const DEFAULT_DURATION_MIN = 30;
const SHORT_DURATION_MIN = 15;
const LONG_DURATION_MIN = 60;
const STEP_MIN = 15;
const TIMEZONE = 'Asia/Kolkata';

function initialTitle(): string {
  const stored = readString('calendarLastTitle');
  return stored?.trim() ? stored : DEFAULT_TITLE;
}

export default function Calendar() {
  const [title, setTitle] = useState<string>(initialTitle);
  const [start, setStart] = useState<Date>(() => nextQuarterHour(new Date()));
  const [durationMin, setDurationMin] = useState<number>(DEFAULT_DURATION_MIN);

  const { status, error, submit } = useSubmission<CalendarPayload>('calendar');
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useCalendarEvents();

  const trimmedTitle = title.trim();
  const end = addMinutes(start, durationMin);
  const isSending = status === 'sending';
  const canSubmit = !isSending && trimmedTitle.length > 0;

  useEffect(() => {
    if (status === 'sent') void refreshEvents();
  }, [status, refreshEvents]);

  function pickTitle(next: string) {
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
    if (!canSubmit) return;
    await submit(() => ({
      title: trimmedTitle,
      start_time: formatForGCal(start, TIMEZONE),
      end_time: formatForGCal(end, TIMEZONE),
      timezone: TIMEZONE,
    }));
    writeString('calendarLastTitle', trimmedTitle);
    setStart(nextQuarterHour(end));
    setDurationMin(DEFAULT_DURATION_MIN);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Calendar Block"
        subtitle="Tap title, drag dials up/down, submit."
      />

      <div className="flex flex-col gap-2">
        {TITLE_ROWS.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2">
            {row.map((t) => {
              const isActive = trimmedTitle === t;
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSending}
          placeholder="Or type a custom title"
          aria-label="Event title"
          className="mt-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DialRow
          label="Start"
          value={formatTime(start)}
          onStep={stepStart}
          onLeftEdgeTap={() => setStart(previousQuarterHour(new Date()))}
          onRightEdgeTap={() => setStart(nextQuarterHour(new Date()))}
          disabled={isSending}
        />

        <DialRow
          label="Duration"
          value={`${durationMin} min`}
          onStep={stepDuration}
          canDecrement={durationMin > STEP_MIN}
          onLeftEdgeTap={() => {
            haptic('tap');
            setDurationMin(SHORT_DURATION_MIN);
          }}
          onRightEdgeTap={() => {
            haptic('tap');
            setDurationMin(LONG_DURATION_MIN);
          }}
          disabled={isSending}
        />
      </div>

      <SummaryFooter start={start} end={end} timezone={TIMEZONE} />

      <EventList
        events={events}
        day={start}
        pending={{ start, end, title: trimmedTitle }}
        loading={eventsLoading}
        error={eventsError}
      />

      <SubmitButton
        label="Schedule"
        onSubmit={() => void handleSubmit()}
        disabled={!canSubmit}
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

function SummaryFooter({
  start,
  end,
  timezone,
}: {
  start: Date;
  end: Date;
  timezone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">Start</span>
        <span className="font-medium tabular-nums text-slate-100">
          {formatDateTime(start)}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">End</span>
        <span className="font-medium tabular-nums text-slate-100">
          {formatDateTime(end)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{timezone}</p>
    </div>
  );
}
