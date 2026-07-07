import { useEffect, useRef, useState } from 'react';
import { searchPeople, type PersonSearchResult } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: PersonSearchResult) => void;
  onCreateNew: (name: string) => void;
}

export function PersonSearchSheet({ open, onClose, onSelect, onCreateNew }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPeople(query.trim());
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Find or add a person"
        className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col bg-slate-950"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <h2 className="flex-1 text-lg font-semibold">Find Person</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5">
          {loading && (
            <p className="py-4 text-xs text-slate-500">Searching…</p>
          )}
          {!loading && results.length > 0 && (
            <ul className="flex flex-col gap-2 pb-2">
              {results.map((r) => (
                <li
                  key={r.filePath}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-slate-100">{r.name}</span>
                    <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {r.score}
                    </span>
                    {r.isPeople && (
                      <span className="rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        People
                      </span>
                    )}
                  </div>
                  {r.contentExcerpt && (
                    <p className="mb-2 text-xs text-slate-500 line-clamp-2">{r.contentExcerpt}</p>
                  )}
                  <p className="mb-2 text-[10px] text-slate-600">{r.filePath}</p>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className="rounded-lg bg-emerald-700/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-700/50 active:scale-95"
                  >
                    This is them →
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <p className="py-3 text-xs text-slate-500">No matches found.</p>
          )}
        </div>

        {/* Create new */}
        {query.trim() && (
          <div className="border-t border-slate-800 px-5 py-4">
            <button
              type="button"
              onClick={() => onCreateNew(query.trim())}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 active:scale-95"
            >
              Create new note for "{query.trim()}"
            </button>
          </div>
        )}
      </div>
    </>
  );
}
