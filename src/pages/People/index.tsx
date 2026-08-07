import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import {
  fetchPeople,
  createPerson,
  savePerson,
  type PersonSummary,
  type PersonSearchResult,
} from '../../lib/api';
import { kolkataDateString } from '../../lib/time';
import { PersonSearchSheet } from './PersonSearchSheet';
import { PersonDetailSheet } from './PersonDetailSheet';

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const date = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} wk ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mo ago`;
  return `${Math.floor(diffDays / 365)} yr ago`;
}

function heatColor(dateStr: string | null): string {
  if (!dateStr) return 'text-rose-400';
  const diffDays = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000);
  if (diffDays <= 14) return 'text-emerald-400';
  if (diffDays <= 60) return 'text-amber-400';
  return 'text-rose-400';
}

const SNOOZE_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return kolkataDateString(d);
}

interface CardMenuProps {
  person: PersonSummary;
  onAction: (filePath: string, updates: Record<string, string>) => Promise<void>;
}

function CardMenu({ person, onAction }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const [snoozeCustom, setSnoozeCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSnoozeCustom(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const isNoContact = person.contactStatus === 'no_contact';
  const isSnoozed = person.snoozeUntil && person.snoozeUntil >= kolkataDateString(new Date());

  async function handleSnooze(until: string) {
    setOpen(false);
    setSnoozeCustom(false);
    await onAction(person.filePath, { snooze_until: until, contact_status: 'active' });
  }

  async function handleNoContact() {
    setOpen(false);
    await onAction(person.filePath, {
      contact_status: isNoContact ? 'active' : 'no_contact',
      snooze_until: '',
    });
  }

  async function handleUnsnooze() {
    setOpen(false);
    await onAction(person.filePath, { snooze_until: '' });
  }

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSnoozeCustom(false); }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
        aria-label="More options"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 min-w-[160px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
          {/* Snooze section */}
          {!isNoContact && !isSnoozed && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                Snooze
              </div>
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => void handleSnooze(addDays(opt.days))}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800"
                >
                  {opt.label}
                </button>
              ))}
              {snoozeCustom ? (
                <div className="flex gap-1 px-3 py-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => customDate && void handleSnooze(customDate)}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSnoozeCustom(true)}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800"
                >
                  Custom date…
                </button>
              )}
              <div className="mx-3 my-1 border-t border-slate-800" />
            </>
          )}

          {/* Unsnooze */}
          {isSnoozed && !isNoContact && (
            <>
              <button
                type="button"
                onClick={() => void handleUnsnooze()}
                className="w-full px-3 py-2 text-left text-xs text-amber-300 transition hover:bg-slate-800"
              >
                Unsnooze
              </button>
              <div className="mx-3 my-1 border-t border-slate-800" />
            </>
          )}

          {/* No contact toggle */}
          <button
            type="button"
            onClick={() => void handleNoContact()}
            className="w-full px-3 py-2 text-left text-xs transition hover:bg-slate-800"
          >
            <span className={isNoContact ? 'text-emerald-400' : 'text-slate-400'}>
              {isNoContact ? '↩ Restore contact' : '✕ No contact'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-2 pb-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

export default function People() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ filePath: string; name: string } | null>(null);

  // Inline filter over the tracked people list (distinct from the "+" full-vault
  // search sheet). Selecting a match stamps last-contacted to the note's mtime.
  const [filterQuery, setFilterQuery] = useState('');

  const today = kolkataDateString(new Date());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPeople(await fetchPeople());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // History-based navigation for detail view
  useEffect(() => {
    function onPop() {
      setSelectedPerson(null);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function openDetail(filePath: string, name: string) {
    setSelectedPerson({ filePath, name });
    history.pushState({ peopleDetail: true }, '');
  }

  function closeDetail() {
    // If we pushed a history entry, go back (triggers popstate → clears selectedPerson)
    if (history.state?.peopleDetail) {
      history.back();
    } else {
      setSelectedPerson(null);
    }
    void load();
  }

  async function handleSelect(result: PersonSearchResult) {
    setSearchOpen(false);
    openDetail(result.filePath, result.name);
  }

  async function handleCreateNew(name: string) {
    setSearchOpen(false);
    try {
      const res = await createPerson(name, '', '', '');
      await load();
      openDetail(res.filePath, res.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    }
  }

  async function handleCardAction(filePath: string, updates: Record<string, string>) {
    await savePerson(filePath, '', '', updates);
    await load();
  }

  // Selecting a person from the inline search auto-stamps last-contacted to the
  // note's last-modified time, then opens their detail.
  async function handleFilterSelect(p: PersonSummary) {
    if (p.mtimeMs) {
      const modifiedDate = kolkataDateString(new Date(p.mtimeMs));
      if (modifiedDate && modifiedDate !== p.lastContacted) {
        try {
          await savePerson(p.filePath, modifiedDate, '', {});
        } catch {
          // Non-fatal — still open the detail even if the stamp write failed.
        }
      }
    }
    openDetail(p.filePath, p.name);
    void load();
  }

  const trimmedFilter = filterQuery.trim().toLowerCase();
  const filtered = trimmedFilter
    ? people.filter(
        (p) =>
          p.name.toLowerCase().includes(trimmedFilter) ||
          (p.preview?.toLowerCase().includes(trimmedFilter) ?? false),
      )
    : null;

  // Partition people into groups
  const active = people.filter(
    (p) => p.contactStatus !== 'no_contact' && !(p.snoozeUntil && p.snoozeUntil >= today),
  );
  const snoozed = people.filter(
    (p) => p.contactStatus !== 'no_contact' && p.snoozeUntil && p.snoozeUntil >= today,
  );
  const noContact = people.filter((p) => p.contactStatus === 'no_contact');

  function PersonCard({ p, onOpen }: { p: PersonSummary; onOpen?: (p: PersonSummary) => void }) {
    const isSnoozed = p.snoozeUntil && p.snoozeUntil >= today;
    return (
      <li>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => (onOpen ? onOpen(p) : openDetail(p.filePath, p.name))}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-slate-700 active:scale-[0.99]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium text-slate-100">{p.name}</span>
              <span className={`text-xs ${isSnoozed ? 'text-amber-400' : heatColor(p.lastContacted)}`}>
                {isSnoozed ? `snoozed until ${p.snoozeUntil}` : relativeTime(p.lastContacted)}
              </span>
            </div>
            {p.preview && (
              <p className="text-xs text-slate-500 line-clamp-1">{p.preview}</p>
            )}
          </button>
          <div className="flex items-center">
            <CardMenu person={p} onAction={handleCardAction} />
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <PageHeader
          title="People"
          meta={loading ? null : `${active.length} active`}
          action={
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-95"
              aria-label="Add person"
            >
              +
            </button>
          }
        />

        {!loading && !error && people.length > 0 && (
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        )}

        {loading && <p className="text-xs text-slate-500">Loading…</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}

        {!loading && !error && people.length === 0 && (
          <p className="text-xs text-slate-500">
            No people yet. Tap + to add someone or create a vault note with{' '}
            <code className="text-slate-400">[[People]]</code>.
          </p>
        )}

        {filtered !== null ? (
          filtered.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {filtered.map((p) => (
                <PersonCard key={p.filePath} p={p} onOpen={handleFilterSelect} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No people match “{filterQuery.trim()}”.</p>
          )
        ) : (
          <>
            {active.length > 0 && (
              <ul className="flex flex-col gap-2">
                {active.map((p) => <PersonCard key={p.filePath} p={p} />)}
              </ul>
            )}

            {snoozed.length > 0 && (
              <>
                <SectionHeader label={`Snoozed · ${snoozed.length}`} />
                <ul className="flex flex-col gap-2">
                  {snoozed.map((p) => <PersonCard key={p.filePath} p={p} />)}
                </ul>
              </>
            )}

            {noContact.length > 0 && (
              <>
                <SectionHeader label={`No contact · ${noContact.length}`} />
                <ul className="flex flex-col gap-2 opacity-50">
                  {noContact.map((p) => <PersonCard key={p.filePath} p={p} />)}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <PersonSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(r) => void handleSelect(r)}
        onCreateNew={(name) => void handleCreateNew(name)}
      />

      {selectedPerson && (
        <PersonDetailSheet
          open={true}
          filePath={selectedPerson.filePath}
          name={selectedPerson.name}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
