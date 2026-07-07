import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { searchNotes, type NoteSearchResult } from '../../lib/api';
import { NoteDetailSheet } from './NoteDetailSheet';

// Read-only vault browser. Search-first: type a query, tap a result to read the
// note, then hop between notes via its wikilinks / backlinks. Nothing here
// writes to the vault — editing stays in Obsidian.
export default function Notes() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchNotes(query.trim()));
        setSearched(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <>
      <section className="flex flex-col gap-3">
        <PageHeader
          title="Notes"
          meta={searched && !loading ? `${results.length} result${results.length === 1 ? '' : 's'}` : null}
        />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the vault…"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />

        {loading && <p className="text-xs text-slate-500">Searching…</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}

        {!loading && !error && searched && results.length === 0 && (
          <p className="text-xs text-slate-500">No matches found.</p>
        )}

        {!query.trim() && (
          <p className="text-xs text-slate-500">
            Type to search across the vault. Tap a note to read it and follow its links.
          </p>
        )}

        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.path}>
                <button
                  type="button"
                  onClick={() => setOpenPath(r.path)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-slate-700 active:scale-[0.99]"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                      {r.title}
                    </span>
                    {r.matchType === 'title' && (
                      <span className="flex-none rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        title
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-xs text-slate-500 line-clamp-2">{r.snippet}</p>
                  <p className="text-[10px] text-slate-600">{r.folder}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openPath && (
        <NoteDetailSheet initialPath={openPath} onClose={() => setOpenPath(null)} />
      )}
    </>
  );
}
