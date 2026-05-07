import { type CalendarEvent } from '../lib/api';
import { formatDayLabel, formatTime, kolkataDateString } from '../lib/time';

type PendingBlock = {
  start: Date;
  end: Date;
  title: string;
};

type Item =
  | { kind: 'event'; data: CalendarEvent; sortKey: number; allDay: boolean }
  | { kind: 'pending'; data: PendingBlock; sortKey: number; allDay: false };

interface Props {
  events: CalendarEvent[];
  day: Date;
  pending?: PendingBlock;
  loading?: boolean;
  error?: string | null;
}

export function EventList({ events, day, pending, loading, error }: Props) {
  const dayKey = kolkataDateString(day);
  const items = buildItems(events, dayKey, pending);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {formatDayLabel(day)}
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

      {!error && items.length === 0 && (
        <p className="text-xs text-slate-500">Nothing scheduled.</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <Row key={rowKey(item)} item={item} now={now} />
        ))}
      </ul>
    </div>
  );
}

function buildItems(
  events: CalendarEvent[],
  dayKey: string,
  pending: PendingBlock | undefined,
): Item[] {
  const items: Item[] = [];

  for (const event of events) {
    if (event.allDay) {
      // GCal all-day end is exclusive: a one-day event has start=YYYY-MM-DD,
      // end=next day. A multi-day event spans [start, end).
      if (event.start <= dayKey && dayKey < event.end) {
        items.push({ kind: 'event', data: event, sortKey: -Infinity, allDay: true });
      }
      continue;
    }
    const startMs = Date.parse(event.start);
    if (Number.isNaN(startMs)) continue;
    if (kolkataDateString(new Date(startMs)) === dayKey) {
      items.push({ kind: 'event', data: event, sortKey: startMs, allDay: false });
    }
  }

  if (pending) {
    items.push({
      kind: 'pending',
      data: pending,
      sortKey: pending.start.getTime(),
      allDay: false,
    });
  }

  items.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.sortKey - b.sortKey;
  });

  return items;
}

function rowKey(item: Item): string {
  return item.kind === 'pending' ? '__pending' : `${item.data.id}`;
}

function Row({ item, now }: { item: Item; now: number }) {
  if (item.kind === 'pending') {
    const { start, end, title } = item.data;
    return (
      <li className="rounded-lg border border-dashed border-emerald-400 bg-emerald-400/10 px-3 py-2">
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
  }

  const event = item.data;

  if (event.allDay) {
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
  const past = endD.getTime() < now;
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
