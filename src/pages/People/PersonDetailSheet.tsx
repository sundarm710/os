import { useEffect, useState } from 'react';
import { fetchPerson, savePerson, type PersonDetail } from '../../lib/api';
import { kolkataDateString } from '../../lib/time';

interface Props {
  open: boolean;
  filePath: string | null;
  name: string;
  onClose: () => void;
}

export function PersonDetailSheet({ open, filePath, name, onClose }: Props) {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable FM fields
  const [lastContacted, setLastContacted] = useState('');
  const [birthday, setBirthday] = useState('');
  const [howKnow, setHowKnow] = useState('');
  const [frequency, setFrequency] = useState('');

  // Interaction log form
  const [logDate, setLogDate] = useState('');
  const [logText, setLogText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !filePath) return;
    setDetail(null);
    setError(null);
    setLogText('');
    setLogDate(kolkataDateString(new Date()));
    setLoading(true);
    fetchPerson(filePath)
      .then((d) => {
        setDetail(d);
        const fm = d.frontmatter;
        setLastContacted(fm['last-contacted'] ?? '');
        setBirthday(fm['birthday'] ?? '');
        setHowKnow(fm['how_know'] ?? '');
        setFrequency(fm['frequency'] ?? '');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath || !logText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fmUpdates: Record<string, string> = {};
      if (lastContacted) fmUpdates['last-contacted'] = lastContacted;
      if (birthday) fmUpdates['birthday'] = birthday;
      if (howKnow) fmUpdates['how_know'] = howKnow;
      if (frequency) fmUpdates['frequency'] = frequency;

      await savePerson(filePath, logDate, logText.trim(), fmUpdates);
      // Refresh
      const d = await fetchPerson(filePath);
      setDetail(d);
      const fm = d.frontmatter;
      setLastContacted(fm['last-contacted'] ?? '');
      setBirthday(fm['birthday'] ?? '');
      setHowKnow(fm['how_know'] ?? '');
      setFrequency(fm['frequency'] ?? '');
      setLogText('');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFmSave() {
    if (!filePath || !detail) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fmUpdates: Record<string, string> = {
        'last-contacted': lastContacted,
        birthday,
        how_know: howKnow,
        frequency,
      };
      await savePerson(filePath, lastContacted || logDate, '', fmUpdates);
      const d = await fetchPerson(filePath);
      setDetail(d);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={`Detail: ${name}`}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
    >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-100"
            aria-label="Back"
          >
            ←
          </button>
          <h2 className="flex-1 truncate text-lg font-semibold text-slate-100">{name}</h2>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-slate-500">Loading…</p>
          </div>
        )}
        {error && (
          <div className="flex flex-1 items-center justify-center px-5">
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {detail && !loading && (
          <div className="flex-1 overflow-y-auto">
            {/* Frontmatter section */}
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">
                Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Last contacted</span>
                  <input
                    type="date"
                    value={lastContacted}
                    onChange={(e) => setLastContacted(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Birthday</span>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">How know</span>
                  <input
                    type="text"
                    value={howKnow}
                    onChange={(e) => setHowKnow(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Frequency</span>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={handleFmSave}
                disabled={submitting}
                className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
              >
                Save details
              </button>
            </div>

            {/* Key facts */}
            {detail.rawBody && (
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                  Key Facts
                </h3>
                <p className="whitespace-pre-wrap text-xs text-slate-300">{detail.rawBody}</p>
              </div>
            )}

            {/* Interactions */}
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">
                Interactions ({detail.interactions.length})
              </h3>
              {detail.interactions.length === 0 && (
                <p className="text-xs text-slate-600">No interactions logged yet.</p>
              )}
              <ul className="flex flex-col gap-3">
                {detail.interactions.map((inter, i) => (
                  <li key={i} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="mb-1 text-[10px] font-medium text-emerald-400">{inter.date}</p>
                    <p className="whitespace-pre-wrap text-xs text-slate-300">{inter.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Log interaction form */}
            <form onSubmit={handleLogSubmit} className="px-5 py-4">
              <h3 className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">
                Log Interaction
              </h3>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Date</span>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">What happened</span>
                  <textarea
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    rows={3}
                    placeholder="Caught up over coffee, talked about…"
                    className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-400 focus:outline-none resize-none"
                  />
                </label>
                {submitError && (
                  <p className="text-xs text-rose-400">{submitError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting || !logText.trim()}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {submitting ? 'Saving…' : 'Log interaction'}
                </button>
              </div>
            </form>
          </div>
        )}
    </div>
  );
}
