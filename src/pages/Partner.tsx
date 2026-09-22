import { useEffect, useState } from 'react';
import { getCachedPerson, type ChecklistAnswer, type PartnerPerson } from '../lib/api';
import { usePartnerTasks } from '../lib/usePartnerTasks';
import { usePartnerChecklist } from '../lib/usePartnerChecklist';
import { haptic } from '../lib/haptic';
import { kolkataDateString } from '../lib/time';
import { PageHeader } from '../components/PageHeader';
import { PartnerTaskCard } from '../components/PartnerTaskCard';
import { AddPartnerTaskSheet } from '../components/AddPartnerTaskSheet';
import { ManagePartnerItemsSheet } from '../components/ManagePartnerItemsSheet';

type Tab = 'tasks' | 'checkin';

const PERSON_LABEL: Record<PartnerPerson, string> = { sundar: 'Sundar', partner: 'Partner' };

function todayIST(): string {
  return kolkataDateString(new Date());
}

export default function Partner() {
  const [tab, setTab] = useState<Tab>('tasks');
  const [you, setYou] = useState<PartnerPerson | null>(getCachedPerson);

  const tasks = usePartnerTasks();
  const [date, setDate] = useState<string>(todayIST);
  const checklist = usePartnerChecklist(date);

  // Identity is learned as a side effect of the first successful fetch (see
  // api.ts) — re-read the cache once loading settles so the UI can label
  // "Me" vs the partner's name without the client ever asserting who it is.
  useEffect(() => {
    if (!tasks.loading) setYou(getCachedPerson());
  }, [tasks.loading]);
  useEffect(() => {
    if (!checklist.loading) setYou(getCachedPerson());
  }, [checklist.loading]);

  const other: PartnerPerson | null = you === 'sundar' ? 'partner' : you === 'partner' ? 'sundar' : null;

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Partner" subtitle={you ? `Signed in as ${PERSON_LABEL[you]}` : undefined} />

      <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        <SegButton label="Tasks" active={tab === 'tasks'} onClick={() => setTab('tasks')} />
        <SegButton label="Check-in" active={tab === 'checkin'} onClick={() => setTab('checkin')} />
      </div>

      {tab === 'tasks' && <TasksTab you={you} other={other} tasks={tasks} />}
      {tab === 'checkin' && (
        <CheckinTab you={you} other={other} date={date} setDate={setDate} checklist={checklist} />
      )}
    </section>
  );
}

function SegButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={[
        'flex-1 rounded-lg py-2 text-sm font-medium transition active:scale-[0.98]',
        active ? 'bg-emerald-500 text-emerald-950' : 'text-slate-400 hover:text-slate-200',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function TasksTab({
  you,
  other,
  tasks,
}: {
  you: PartnerPerson | null;
  other: PartnerPerson | null;
  tasks: ReturnType<typeof usePartnerTasks>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const mine = tasks.open.filter((t) => t.assignee === you);
  const shared = tasks.open.filter((t) => t.assignee === null);
  const theirs = tasks.open.filter((t) => t.assignee === other && other !== null);

  return (
    <div className="flex flex-col gap-5 pb-24">
      {tasks.error && (
        <p className="rounded-lg border border-rose-800 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {tasks.error}
        </p>
      )}

      <TaskSection title="Mine" tasks={mine} you={you} onComplete={tasks.complete} />
      <TaskSection title="Shared" tasks={shared} you={you} onComplete={tasks.complete} />
      {other && <TaskSection title={PERSON_LABEL[other]} tasks={theirs} you={you} onComplete={tasks.complete} />}

      {tasks.done.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Recently done</span>
          <ul className="flex flex-col gap-2">
            {tasks.done.map((t) => (
              <PartnerTaskCard key={t.id} task={t} you={you} muted onReopen={tasks.reopen} />
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          haptic('tap');
          setSheetOpen(true);
        }}
        aria-label="Add task"
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        +
      </button>

      <AddPartnerTaskSheet
        open={sheetOpen}
        you={you}
        onClose={() => setSheetOpen(false)}
        onAdd={tasks.addTask}
      />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  you,
  onComplete,
}: {
  title: string;
  tasks: ReturnType<typeof usePartnerTasks>['open'];
  you: PartnerPerson | null;
  onComplete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">{title}</span>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <PartnerTaskCard key={t.id} task={t} you={you} onComplete={onComplete} />
        ))}
      </ul>
    </div>
  );
}

function CheckinTab({
  you,
  other,
  date,
  setDate,
  checklist,
}: {
  you: PartnerPerson | null;
  other: PartnerPerson | null;
  date: string;
  setDate: (d: string) => void;
  checklist: ReturnType<typeof usePartnerChecklist>;
}) {
  const [draft, setDraft] = useState<Record<string, { value_bool?: boolean; value_text?: string }>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  // Seed the draft from the server's own-answers whenever the day's data loads.
  useEffect(() => {
    if (!checklist.dayItems || !you) return;
    const next: Record<string, { value_bool?: boolean; value_text?: string }> = {};
    for (const item of checklist.dayItems) {
      const mine = item[you];
      if (mine) next[item.id] = { value_bool: mine.value_bool ?? undefined, value_text: mine.value_text ?? undefined };
    }
    setDraft(next);
    setSaveState('idle');
  }, [checklist.dayItems, you]);

  const partnerNote =
    other &&
    checklist.dayItems?.some((i) => i.audience === 'partner_note' && i[other]?.value_text);

  async function handleSave() {
    if (!checklist.dayItems) return;
    setSaveState('saving');
    setSaveError(null);
    haptic('submitStart');
    const answers: ChecklistAnswer[] = checklist.dayItems
      .filter((item) => draft[item.id] !== undefined)
      .map((item) => ({ item_id: item.id, ...draft[item.id] }));
    try {
      await checklist.submit(date, answers);
      haptic('successRamp');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaveState('error');
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-slate-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-base text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
      </div>

      {partnerNote && other && (
        <div className="rounded-xl border border-violet-700/50 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          📝 Note from {PERSON_LABEL[other]} today
        </div>
      )}

      {checklist.error && (
        <p className="rounded-lg border border-rose-800 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {checklist.error}
        </p>
      )}

      {checklist.dayItems && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-500/5 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-emerald-300">Your check-in</p>
          <div className="flex flex-col gap-4">
            {checklist.dayItems
              .filter((i) => i.item_type === 'boolean')
              .map((item) => {
                const checked = draft[item.id]?.value_bool === true;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      haptic('tap');
                      setDraft((prev) => ({ ...prev, [item.id]: { value_bool: !checked } }));
                    }}
                    className={[
                      'self-start rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95',
                      checked
                        ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {checked ? '✓ ' : ''}{item.label}
                  </button>
                );
              })}
            {checklist.dayItems
              .filter((i) => i.item_type === 'text')
              .map((item) => (
                <div key={item.id} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">{item.label}</label>
                  <textarea
                    value={draft[item.id]?.value_text ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [item.id]: { value_text: e.target.value } }))
                    }
                    rows={2}
                    placeholder={item.label}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              ))}
          </div>

          <button
            type="button"
            disabled={saveState === 'saving'}
            onClick={() => void handleSave()}
            className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-950 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save check-in'}
          </button>
          {saveState === 'saved' && <p className="mt-2 text-sm text-emerald-400">Saved ✓</p>}
          {saveState === 'error' && <p className="mt-2 text-sm text-rose-400">{saveError}</p>}
        </div>
      )}

      {other && checklist.dayItems && (
        <div className="rounded-xl border border-violet-700/40 bg-violet-500/5 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-violet-300">
            {PERSON_LABEL[other]}'s check-in
          </p>
          <div className="flex flex-col gap-3">
            {checklist.dayItems.map((item) => {
              const answer = item[other];
              if (!answer || (answer.value_bool == null && !answer.value_text)) return null;
              return (
                <div key={item.id} className="text-sm">
                  <p className="text-slate-500">{item.label}</p>
                  <p className="text-slate-200">
                    {item.item_type === 'boolean' ? (answer.value_bool ? '✓ Yes' : 'No') : answer.value_text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          haptic('tap');
          setManageOpen(true);
        }}
        className="self-start text-xs text-slate-500 underline decoration-dotted hover:text-slate-300"
      >
        ⚙️ Manage items
      </button>

      <ManagePartnerItemsSheet
        open={manageOpen}
        items={checklist.items}
        onClose={() => setManageOpen(false)}
        onAdd={(label, type, audience) => checklist.addItem(label, type, audience).then(() => undefined)}
        onDeactivate={checklist.deactivateItem}
        onReorder={checklist.reorderItems}
      />
    </div>
  );
}
