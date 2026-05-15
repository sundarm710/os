import { useMemo, useState } from 'react';
import {
  type WorkoutExercise,
  type WorkoutFetchType,
  type WorkoutSession,
  type WorkoutSet,
} from '../lib/api';
import { haptic } from '../lib/haptic';
import { useWorkouts } from '../lib/useWorkouts';
import { PageHeader } from '../components/PageHeader';

type Tab = Exclude<WorkoutFetchType, 'all'>;

const TABS: { id: Tab; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
];

const CATEGORY_ORDER: Record<string, number> = {
  warmup: 0,
  main: 1,
  cooldown: 2,
};

const CATEGORY_LABEL: Record<string, string> = {
  warmup: 'Warmup',
  main: 'Main',
  cooldown: 'Cooldown',
};

export default function Workouts() {
  const [tab, setTab] = useState<Tab>('strength');
  const { sessions, loading, error, refresh } = useWorkouts(tab);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="Workouts"
        action={
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              void refresh();
            }}
            disabled={loading}
            className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition active:scale-95 hover:border-slate-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        }
      />

      <div role="tablist" aria-label="Workout type" className="grid grid-cols-2 gap-2">
        {TABS.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (t.id === tab) return;
                haptic('tap');
                setTab(t.id);
              }}
              className={[
                'rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-[0.98]',
                isActive
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {!error && loading && sessions.length === 0 && (
        <p className="text-sm text-slate-500">Loading sessions…</p>
      )}

      {!error && !loading && sessions.length === 0 && (
        <p className="text-sm text-slate-500">
          No {tab} sessions yet.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </ul>
    </section>
  );
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const exercises = useMemo(() => sortedExercises(session.exercises), [session.exercises]);
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {formatSessionDate(session.date)}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {sessionMeta(session)}
          </p>
        </div>
        <CopyButton text={session.copy_text} />
      </header>

      {session.overall_feel && (
        <p className="mt-2 text-sm italic text-slate-300">{session.overall_feel}</p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {exercises.map((ex) => (
          <ExerciseBlock key={`${ex.exercise_name}-${ex.exercise_category}`} exercise={ex} />
        ))}
      </div>
    </li>
  );
}

function ExerciseBlock({ exercise }: { exercise: WorkoutExercise }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-100">{exercise.exercise_name}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          {CATEGORY_LABEL[exercise.exercise_category] ?? exercise.exercise_category} ·{' '}
          {exercise.modality.replace('_', ' ')}
        </p>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-slate-300">
        {exercise.sets.map((set) => (
          <li key={set.set_number} className="tabular-nums">
            <SetLine set={set} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SetLine({ set }: { set: WorkoutSet }) {
  const skipped = set.status === 'skipped';
  const failed = set.status === 'failed';
  const loadText = formatLoad(set);
  const repsText = formatReps(set);
  const main = [loadText, repsText].filter(Boolean).join(' × ');
  const note = [set.feel_notes, set.cue_notes].filter(Boolean).join(' · ');
  return (
    <div className={skipped ? 'text-slate-500 line-through' : ''}>
      <span className="text-slate-500">Set {set.set_number}</span>
      {main && <span className="ml-2 text-slate-100">{main}</span>}
      {!main && skipped && <span className="ml-2">skipped</span>}
      {!main && failed && <span className="ml-2 text-rose-300">failed</span>}
      {note && <span className="ml-2 text-xs text-slate-400">— {note}</span>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    haptic('tap');
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 1500);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95',
        state === 'copied'
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : state === 'error'
            ? 'border-rose-500 bg-rose-500/10 text-rose-300'
            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600',
      ].join(' ')}
      aria-label="Copy session as text"
    >
      {state === 'copied' ? 'Copied ✓' : state === 'error' ? 'Copy failed' : 'Copy'}
    </button>
  );
}

function sortedExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return [...exercises].sort((a, b) => {
    const ca = CATEGORY_ORDER[a.exercise_category] ?? 99;
    const cb = CATEGORY_ORDER[b.exercise_category] ?? 99;
    if (ca !== cb) return ca - cb;
    return a.exercise_name.localeCompare(b.exercise_name);
  });
}

function formatLoad(set: WorkoutSet): string {
  if (set.weight_kg != null) return `${trim(set.weight_kg)}kg`;
  if (set.left_weight_kg != null || set.right_weight_kg != null) {
    const l = set.left_weight_kg;
    const r = set.right_weight_kg;
    if (l != null && r != null && l === r) return `${trim(l)}kg/side`;
    return `L${trim(l ?? 0)} · R${trim(r ?? 0)}kg`;
  }
  if (set.duration_seconds != null) return `${set.duration_seconds}s`;
  return '';
}

function formatReps(set: WorkoutSet): string {
  if (set.reps != null) return `${set.reps} reps`;
  return '';
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function sessionMeta(session: WorkoutSession): string {
  const parts: string[] = [];
  if (session.program_phase != null) parts.push(`Phase ${session.program_phase}`);
  if (session.program_week != null) parts.push(`Week ${session.program_week}`);
  parts.push(`${session.exercises.length} exercises`);
  return parts.join(' · ');
}

// Session `date` comes as UTC midnight (Postgres DATE → ISO at 00:00:00Z).
// Slicing keeps the calendar day without TZ shenanigans.
function formatSessionDate(iso: string): string {
  const dateKey = iso.slice(0, 10);
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}
