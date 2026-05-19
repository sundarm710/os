import { useEffect, useState } from 'react';
import { type CalendarEvent, type CalendarPayload, postTaskAction } from '../lib/api';
import { haptic } from '../lib/haptic';
import {
  clearCalendarPrefill,
  readCalendarPrefill,
  readString,
  writeString,
} from '../lib/storage';
import {
  addMinutes,
  ceilToQuarterHour,
  formatDateTime,
  formatDayLabel,
  formatForGCal,
  formatTime,
  formatTime24,
  kolkataDateString,
  nextQuarterHour,
  previousQuarterHour,
  snapToQuarterHour,
} from '../lib/time';
import { useCalendarEvents } from '../lib/useCalendarEvents';
import { useLongPress } from '../lib/useLongPress';
import { useSubmission } from '../lib/useSubmission';
import { DialRow } from '../components/DialRow';
import { EventList } from '../components/EventList';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

const TITLE_ROWS = [
  ['Amrutha', 'Build', 'Workout', 'Chess'],
  ['German', 'Admin', 'Chill', 'Sleep'],
  ['Chores', 'Commute', 'Talk', 'Wedding'],
  ['Breakfast', 'Lunch', 'Dinner', 'Reading'],
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

function initialFromPrefill() {
  const p = readCalendarPrefill();
  if (!p) return null;
  // Prefer the prefill's startTime when present (re-scheduling an already
  // scheduled task lands on the same time); otherwise use the next quarter
  // hour. Browser is assumed to be IST; constructing via the +05:30 ISO
  // suffix sidesteps tz drift on devices in other zones.
  let hh: string;
  let mm: string;
  if (p.startTime && /^\d{2}:\d{2}$/.test(p.startTime)) {
    [hh, mm] = p.startTime.split(':');
  } else {
    const nq = nextQuarterHour(new Date());
    hh = String(nq.getHours()).padStart(2, '0');
    mm = String(nq.getMinutes()).padStart(2, '0');
  }
  const start = new Date(`${p.date}T${hh}:${mm}:00+05:30`);
  return { title: p.title, start, durationMin: p.durationMin, taskId: p.taskId };
}

/**
 * Title-button activeness recognizes both:
 *   - the bare prefix ("Build" matches "Build" and "Build [Workout]")
 *   - bracketed tags  ("Workout" matches "Build [Workout]")
 * so the user gets visual feedback on the composed title in either role.
 */
function isTitleActive(currentTitle: string, candidate: string): boolean {
  const t = currentTitle.trim();
  if (t === candidate) return true;
  if (t.startsWith(`${candidate} [`)) return true;
  if (t.includes(`[${candidate}]`)) return true;
  return false;
}

/**
 * Append `[Tag]` to the title for downstream categorisation. Idempotent — a
 * tag already present (as bare prefix or bracketed) is left alone, so
 * long-pressing the same chip twice doesn't double-up.
 */
function appendTitleTag(currentTitle: string, tag: string): string {
  const t = currentTitle.trim();
  if (t === tag || t.startsWith(`${tag} [`) || t.includes(`[${tag}]`)) return t;
  const marker = `[${tag}]`;
  return t ? `${t} ${marker}` : marker;
}

export default function Calendar() {
  const initialPrefill = initialFromPrefill();
  const [title, setTitle] = useState<string>(
    () => initialPrefill?.title ?? initialTitle(),
  );
  const [start, setStart] = useState<Date>(
    () => initialPrefill?.start ?? nextQuarterHour(new Date()),
  );
  const [durationMin, setDurationMin] = useState<number>(
    () => initialPrefill?.durationMin ?? DEFAULT_DURATION_MIN,
  );
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(
    initialPrefill?.taskId ?? null,
  );

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

  function stepDate(direction: 1 | -1) {
    setStart((prev) => addMinutes(prev, direction * 24 * 60));
  }

  function stepDuration(direction: 1 | -1) {
    setDurationMin((prev) => Math.max(STEP_MIN, prev + direction * STEP_MIN));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    // Snapshot values that handleSubmit needs after the await; state setters
    // below shift `start` to `end`, so reading start later would give wrong
    // date/time for the post-schedule task update.
    const scheduledStart = start;
    const taskId = pendingTaskId;

    await submit(() => ({
      title: trimmedTitle,
      start_time: formatForGCal(start, TIMEZONE),
      end_time: formatForGCal(end, TIMEZONE),
      timezone: TIMEZONE,
    }));
    writeString('calendarLastTitle', trimmedTitle);

    if (taskId) {
      // Best-effort: stamp ⏳ on the task line. If this fails (offline, server
      // hiccup) the GCal event is still saved; the user can re-tap 📅 on the
      // task to retry. Known gap: that retry will leave the prior GCal event
      // orphaned — closed by future bidirectional work.
      try {
        await postTaskAction({
          action: 'schedule',
          id: taskId,
          date: kolkataDateString(scheduledStart),
          time: formatTime24(scheduledStart),
        });
      } catch (e) {
        console.warn('schedule action failed', e);
      }
      clearCalendarPrefill();
      setPendingTaskId(null);
    }

    // Land Start exactly on the just-scheduled event's end so back-to-back
    // blocks chain naturally — no quarter-hour rounding gap.
    setStart(end);
    setDurationMin(DEFAULT_DURATION_MIN);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Calendar Block"
        action={
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95',
              canSubmit
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-slate-800 text-slate-500',
            ].join(' ')}
          >
            {isSending ? 'Saving…' : 'Schedule'}
          </button>
        }
      />

      <div className="flex flex-col gap-2">
        {TITLE_ROWS.map((row, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2">
            {row.map((t) => (
              <TitleButton
                key={t}
                label={t}
                active={isTitleActive(trimmedTitle, t)}
                disabled={isSending}
                onPick={() => pickTitle(t)}
                onAppend={() => {
                  haptic('submitStart');
                  setTitle((cur) => appendTitleTag(cur, t));
                }}
              />
            ))}
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

      <div className="grid grid-cols-3 gap-2">
        <DialRow
          label="Date"
          value={formatDayLabel(start)}
          onStep={stepDate}
          disabled={isSending}
        />

        <DialRow
          label="Start"
          value={formatTime24(start)}
          onStep={stepStart}
          onLeftEdgeTap={() => setStart(previousQuarterHour(new Date()))}
          onRightEdgeTap={() => setStart(nextFreeStart(events, new Date()))}
          disabled={isSending}
        />

        <DialRow
          label="Duration"
          value={`${durationMin}`}
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

      <SummaryFooter start={start} end={end} />

      <SubmitButton
        label="Schedule"
        onSubmit={() => void handleSubmit()}
        disabled={!canSubmit}
        status={status}
        error={error}
      />

      <EventList
        events={events}
        pending={{ start, end, title: trimmedTitle }}
        loading={eventsLoading}
        error={eventsError}
      />

      <StatusLine
        status={status}
        sentLabel="Scheduled ✓"
        queuedLabel="Saved — will sync"
      />
    </section>
  );
}

/**
 * Find the soonest quarter-hour boundary at or after `now` that isn't
 * inside a scheduled event. Walks the timed events in chronological order;
 * if the cursor lands inside an event, jumps to its end snapped *up* to a
 * quarter (events on quarter boundaries chain back-to-back with no gap —
 * `ceilToQuarterHour`, not `nextQuarterHour`, since the latter would skip a
 * 15-minute slot when the event end is already aligned). All-day events are
 * ignored — they don't block specific times.
 */
function nextFreeStart(events: CalendarEvent[], now: Date): Date {
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) }))
    .filter((e) => !Number.isNaN(e.start) && !Number.isNaN(e.end))
    .sort((a, b) => a.start - b.start);

  let cursor = nextQuarterHour(now);
  for (const event of timed) {
    if (event.end <= cursor.getTime()) continue;
    if (event.start > cursor.getTime()) return cursor;
    cursor = ceilToQuarterHour(new Date(event.end));
  }
  return cursor;
}

function TitleButton({
  label,
  active,
  disabled,
  onPick,
  onAppend,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPick: () => void;
  onAppend: () => void;
}) {
  const press = useLongPress({ onShortPress: onPick, onLongPress: onAppend });
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
      {...press}
      className={[
        'rounded-full border px-3 py-2 text-center text-sm font-medium transition active:scale-95',
        active
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function SummaryFooter({ start, end }: { start: Date; end: Date }) {
  const sameDay = kolkataDateString(start) === kolkataDateString(end);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm">
      <div className="flex items-baseline justify-center gap-2 tabular-nums text-slate-100">
        <span>{formatDateTime(start)}</span>
        <span className="text-slate-500">→</span>
        <span>{sameDay ? formatTime(end) : formatDateTime(end)}</span>
      </div>
    </div>
  );
}
