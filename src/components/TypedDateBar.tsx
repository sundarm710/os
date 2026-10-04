import { useState } from 'react';
import { haptic } from '../lib/haptic';
import { resolveDueToken } from '../lib/taskInput';
import { formatDayLabelLong } from '../lib/time';

interface Props {
  /** Fired with the resolved YYYY-MM-DD on ↵. */
  onPick: (date: string) => void;
  onClose: () => void;
  /** Tab / "more" — hand off to the full DateSheet (chips, picker, clear). */
  onMore?: () => void;
}

function parseISTDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`);
}

// Keyboard reschedule box shared by Replan and the Tasks list: type a date
// token (@tomorrow / fri / 3d / 2026-08-05), ↵ to apply, esc to close, tab
// for the full sheet. Mount it fresh each time so the text starts empty.
export function TypedDateBar({ onPick, onClose, onMore }: Props) {
  const [dateText, setDateText] = useState<string>('');

  // Resolve the typed date live for the preview (leading '@' optional).
  const resolvedDate = dateText.trim()
    ? resolveDueToken(dateText.trim().replace(/^@/, ''), new Date())
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-slate-900 px-3 py-2.5">
        <span className="select-none text-sm text-slate-500">@</span>
        <input
          autoFocus
          type="text"
          value={dateText}
          onChange={(e) => setDateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (resolvedDate) {
                haptic('tap');
                onPick(resolvedDate);
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'Tab' && onMore) {
              e.preventDefault();
              onMore();
            }
          }}
          placeholder="tomorrow · fri · 3d · 2w · 2026-08-05"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="text-[11px] text-slate-500 hover:text-slate-200"
          >
            more <span className="text-slate-600">tab</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-slate-600 hover:text-slate-300"
        >
          esc
        </button>
      </div>
      <div className="px-1 text-[11px]">
        {dateText.trim() === '' ? (
          <span className="text-slate-600">
            Type a date, ↵ to reschedule · tab for more options · esc to close
          </span>
        ) : resolvedDate ? (
          <span className="text-emerald-300">
            → {formatDayLabelLong(parseISTDate(resolvedDate))}
            <span className="ml-1 text-slate-600">↵</span>
          </span>
        ) : (
          <span className="text-rose-400">unrecognised date</span>
        )}
      </div>
    </div>
  );
}
