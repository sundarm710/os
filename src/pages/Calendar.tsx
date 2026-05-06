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
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

const TITLES = ['Build', 'Chill', 'Amrutha', 'Chores', 'Admin'] as const;
type Title = (typeof TITLES)[number];
const DEFAULT_TITLE: Title = 'Build';
const DEFAULT_DURATION_MIN = 60;
const STEP_MIN = 15;
const TIMEZONE = 'Asia/Kolkata';

function initialTitle(): Title {
  const stored = readString('calendarLastTitle');
  return TITLES.includes(stored as Title) ? (stored as Title) : DEFAULT_TITLE;
}

export default function Calendar() {
  const [title, setTitle] = useState<Title>(initialTitle);
  const [start, setStart] = useState<Date>(() => nextQuarterHour(new Date()));
  const [durationMin, setDurationMin] = useState<number>(DEFAULT_DURATION_MIN);

  const { status, error, submit } = useSubmission<CalendarPayload>('calendar');

  const end = addMinutes(start, durationMin);

  function pickTitle(next: Title) {
    haptic('tap');
    setTitle(next);
  }

  function nudgeStart(deltaMin: number) {
    haptic('tap');
    setStart((prev) => snapToQuarterHour(addMinutes(prev, deltaMin)));
  }

  function nudgeDuration(deltaMin: number) {
    haptic('tap');
    setDurationMin((prev) => Math.max(STEP_MIN, prev + deltaMin));
  }

  async function handleSubmit() {
    if (status === 'sending') return;
    await submit(() => ({
      title,
      start_time: formatForGCal(start, TIMEZONE),
      end_time: formatForGCal(end, TIMEZONE),
      timezone: TIMEZONE,
    }));
    writeString('calendarLastTitle', title);
    // Roll the start forward to the next slot so the next capture gets a
    // sensible default (matches "I just blocked 2-3, now offer 3-4" intuition).
    setStart(nextQuarterHour(end));
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Calendar Block"
        subtitle="Tap title, adjust if needed, submit."
      />

      <div className="flex flex-wrap gap-2">
        {TITLES.map((t) => {
          const isActive = title === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={isActive}
              onClick={() => pickTitle(t)}
              disabled={status === 'sending'}
              className={[
                'rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95',
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

      <AdjustableRow
        label="Start"
        value={formatTime(start)}
        onMinus={() => nudgeStart(-STEP_MIN)}
        onPlus={() => nudgeStart(STEP_MIN)}
        disabled={status === 'sending'}
      />

      <AdjustableRow
        label="Duration"
        value={`${durationMin} min`}
        onMinus={() => nudgeDuration(-STEP_MIN)}
        onPlus={() => nudgeDuration(STEP_MIN)}
        disabled={status === 'sending' || durationMin <= STEP_MIN}
        disablePlus={status === 'sending'}
      />

      <p className="text-xs text-slate-500">
        Ends at {formatTime(end)} · {TIMEZONE}
      </p>

      <SubmitButton
        label="Schedule"
        onSubmit={() => void handleSubmit()}
        disabled={status === 'sending'}
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

type RowProps = {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
  disablePlus?: boolean;
};

function AdjustableRow({
  label,
  value,
  onMinus,
  onPlus,
  disabled = false,
  disablePlus,
}: RowProps) {
  const minusDisabled = disabled;
  const plusDisabled = disablePlus ?? disabled;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-base font-medium text-slate-100">{value}</span>
      </div>
      <div className="flex gap-2">
        <NudgeButton onClick={onMinus} disabled={minusDisabled} symbol="−" aria-label={`${label} minus`} />
        <NudgeButton onClick={onPlus} disabled={plusDisabled} symbol="+" aria-label={`${label} plus`} />
      </div>
    </div>
  );
}

type NudgeProps = {
  onClick: () => void;
  disabled?: boolean;
  symbol: string;
  'aria-label': string;
};

function NudgeButton({ onClick, disabled, symbol, ...rest }: NudgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold transition active:scale-95',
        disabled
          ? 'border-slate-800 bg-slate-900 text-slate-600'
          : 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600',
      ].join(' ')}
    >
      {symbol}
    </button>
  );
}
