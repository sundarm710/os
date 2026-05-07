import { forwardRef, Fragment, useLayoutEffect, useRef } from 'react';
import { type CalendarEvent } from '../lib/api';
import { formatDayLabel, formatTime, kolkataDateString } from '../lib/time';

type PendingBlock = {
  start: Date;
  end: Date;
  title: string;
};

type EventItem = {
  kind: 'event';
  data: CalendarEvent;
  dayKey: string;
  startMs: number; // for timed events; for all-day = midnight IST of start day
  allDay: boolean;
};

type PendingItem = {
  kind: 'pending';
  data: PendingBlock;
  dayKey: string;
  startMs: number;
  allDay: false;
};

type Item = EventItem | PendingItem;

interface Props {
  events: CalendarEvent[];
  pending?: PendingBlock;
  loading?: boolean;
  error?: string | null;
}

export function EventList({ events, pending, loading, error }: Props) {
  const items = buildItems(events, pending);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLLIElement>(null);

  // Centre the phantom row whenever the pending slot or the underlying event
  // list shifts. useLayoutEffect so the recentre happens before paint — no
  // visible jump as the user drags the Start dial.
  useLayoutEffect(() => {
    const el = pendingRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    container.scrollTop =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
  }, [pending?.start.getTime(), pending?.end.getTime(), events]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Schedule
        </span>
        {loading && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Refreshing…
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-700/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        className="relative h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30"
      >
        {items.length === 0 && !error ? (
          <p className="px-3 py-3 text-xs text-slate-500">
            Nothing scheduled in this window.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {items.map((item, idx) => {
              const prev = items[idx - 1];
              const showDivider = !prev || prev.dayKey !== item.dayKey;
              if (item.kind === 'pending') {
                return (
                  <Fragment key="__pending">
                    {showDivider && (
                      <DayDivider label={formatDayLabel(item.data.start)} />
                    )}
                    <PendingRow ref={pendingRef} pending={item.data} />
                  </Fragment>
                );
              }
              return (
                <Fragment key={item.data.id}>
                  {showDivider && (
                    <DayDivider label={dayLabelForEvent(item)} />
                  )}
                  <EventRow event={item.data} allDay={item.allDay} />
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 px-1 pb-1 pt-2 text-[10px] uppercase tracking-wider text-slate-500 first:pt-0">
      <span className="h-px flex-1 bg-slate-700" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-slate-700" />
    </li>
  );
}

const PendingRow = forwardRef<HTMLLIElement, { pending: PendingBlock }>(
  function PendingRow({ pending }, ref) {
    const { start, end, title } = pending;
    return (
      <li
        ref={ref}
        className="rounded-lg border border-dashed border-emerald-400 bg-emerald-400/10 px-3 py-2"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-emerald-100">
            {title || 'Untitled'}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-emerald-200">
            {formatTime(start)} – {formatTime(end)}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-emerald-300/80">
          New block
        </span>
      </li>
    );
  },
);

function EventRow({
  event,
  allDay,
}: {
  event: CalendarEvent;
  allDay: boolean;
}) {
  if (allDay) {
    return (
      <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm text-slate-200">
            {event.title || 'Untitled'}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
            All day
          </span>
        </div>
      </li>
    );
  }

  const startD = new Date(event.start);
  const endD = new Date(event.end);
  const past = endD.getTime() < Date.now();
  return (
    <li
      className={[
        'rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2',
        past ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-slate-200">
          {event.title || 'Untitled'}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {formatTime(startD)} – {formatTime(endD)}
        </span>
      </div>
      {event.location && (
        <span className="block truncate text-[11px] text-slate-500">
          {event.location}
        </span>
      )}
    </li>
  );
}

function buildItems(
  events: CalendarEvent[],
  pending: PendingBlock | undefined,
): Item[] {
  const items: Item[] = [];

  for (const event of events) {
    if (event.allDay) {
      const dayMs = istMidnightMs(event.start);
      if (Number.isNaN(dayMs)) continue;
      items.push({
        kind: 'event',
        data: event,
        dayKey: event.start,
        startMs: dayMs,
        allDay: true,
      });
      continue;
    }
    const startMs = Date.parse(event.start);
    if (Number.isNaN(startMs)) continue;
    items.push({
      kind: 'event',
      data: event,
      dayKey: kolkataDateString(new Date(startMs)),
      startMs,
      allDay: false,
    });
  }

  if (pending) {
    items.push({
      kind: 'pending',
      data: pending,
      dayKey: kolkataDateString(pending.start),
      startMs: pending.start.getTime(),
      allDay: false,
    });
  }

  items.sort((a, b) => {
    if (a.dayKey !== b.dayKey) {
      return istMidnightMs(a.dayKey) - istMidnightMs(b.dayKey);
    }
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.startMs - b.startMs;
  });

  return items;
}

function istMidnightMs(yyyymmdd: string): number {
  return Date.parse(`${yyyymmdd}T00:00:00+05:30`);
}

function dayLabelForEvent(item: EventItem): string {
  const d = item.allDay
    ? new Date(istMidnightMs(item.data.start))
    : new Date(item.data.start);
  return formatDayLabel(d);
}
