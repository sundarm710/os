import { useEffect, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { fetchNote, type NoteDetail } from '../../lib/api';

interface Props {
  initialPath: string;
  onClose: () => void;
}

// Full-screen reader with an internal navigation stack: following a wikilink or
// backlink pushes onto the stack; Back pops (or closes the sheet at the root).
// A single popstate entry lets the Android/browser back gesture drive the same
// pop, so the whole flow feels like one screen rather than a modal trap.
export function NoteDetailSheet({ initialPath, onClose }: Props) {
  const [stack, setStack] = useState<string[]>([initialPath]);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPath = stack[stack.length - 1];

  // Push one history entry for the sheet lifetime so the hardware/browser back
  // gesture pops our stack instead of leaving the app.
  useEffect(() => {
    history.pushState({ noteSheet: true }, '');
    function onPop() {
      setStack((s) => {
        if (s.length > 1) {
          // Re-arm a history entry — we consumed the one popstate just fired.
          history.pushState({ noteSheet: true }, '');
          return s.slice(0, -1);
        }
        onClose();
        return s;
      });
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNote(null);
    setError(null);
    setLoading(true);
    fetchNote(currentPath)
      .then((d) => { if (!cancelled) setNote(d); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPath]);

  function navigate(path: string) {
    if (!path) return;
    history.pushState({ noteSheet: true }, '');
    setStack((s) => [...s, path]);
  }

  function back() {
    if (history.state?.noteSheet) {
      history.back(); // triggers popstate → pops stack or closes
    } else if (stack.length > 1) {
      setStack((s) => s.slice(0, -1));
    } else {
      onClose();
    }
  }

  const resolvedOutgoing = (note?.outgoing ?? []).filter((l) => l.exists);

  return (
    <div
      role="dialog"
      aria-label={note ? note.title : 'Note'}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <button
          type="button"
          onClick={back}
          className="text-slate-400 transition hover:text-slate-100"
          aria-label="Back"
        >
          ←
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">
          {note?.title ?? '…'}
        </h2>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-slate-500">Loading…</p>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-1 items-center justify-center px-5">
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {note && !loading && (
        <div className="flex-1 overflow-y-auto">
          {/* Path + tags */}
          <div className="border-b border-slate-800 px-5 py-3">
            <p className="text-[10px] text-slate-600">{note.path}</p>
            {note.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {note.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <Markdown text={note.body} className="text-sm text-slate-300" />
          </div>

          {/* Outgoing links */}
          {resolvedOutgoing.length > 0 && (
            <div className="border-t border-slate-800 px-5 py-4">
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                Links ({resolvedOutgoing.length})
              </h3>
              <ul className="flex flex-col gap-1.5">
                {resolvedOutgoing.map((l) => (
                  <li key={l.path}>
                    <button
                      type="button"
                      onClick={() => navigate(l.path)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-slate-700 active:scale-[0.99]"
                    >
                      <span className="text-xs font-medium text-emerald-300">{l.title}</span>
                      {l.excerpt && (
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{l.excerpt}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Backlinks */}
          {note.backlinks.length > 0 && (
            <div className="border-t border-slate-800 px-5 py-4">
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                Linked from ({note.backlinks.length})
              </h3>
              <ul className="flex flex-col gap-1.5">
                {note.backlinks.map((b) => (
                  <li key={b.path}>
                    <button
                      type="button"
                      onClick={() => navigate(b.path)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-slate-700 active:scale-[0.99]"
                    >
                      <span className="text-xs font-medium text-slate-200">{b.title}</span>
                      {b.excerpt && (
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{b.excerpt}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
