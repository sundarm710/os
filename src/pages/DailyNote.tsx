import { useCallback, useEffect, useState } from 'react';
import {
  fetchDailyNote,
  fetchDailyNoteSchema,
  saveDailyNote,
  type DailyNoteField,
} from '../lib/api';
import { haptic } from '../lib/haptic';
import { kolkataDateString } from '../lib/time';
import { PageHeader } from '../components/PageHeader';
import { StatusLine } from '../components/StatusLine';
import { SubmitButton } from '../components/SubmitButton';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const RATING_OPTIONS = [
  { value: '🟩', label: 'Good' },
  { value: '🟨', label: 'Meh' },
  { value: '🟥', label: 'Bad' },
];

function todayIST(): string {
  return kolkataDateString(new Date());
}

export default function DailyNote() {
  const [date, setDate] = useState<string>(todayIST);
  const [schema, setSchema] = useState<DailyNoteField[] | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load schema once on mount
  useEffect(() => {
    fetchDailyNoteSchema()
      .then((fields) => setSchema(fields))
      .catch((e) => setSchemaError(e instanceof Error ? e.message : 'failed to load schema'));
  }, []);

  const loadNote = useCallback(async (d: string) => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const v = await fetchDailyNote(d);
      const processed: Record<string, string> = {};
      for (const [key, val] of Object.entries(v)) {
        const m = val.match(/^(🟩|🟨|🟥) (.+)$/);
        if (m) {
          processed[key] = m[1];
          processed[`${key}_note`] = m[2];
        } else {
          processed[key] = val;
        }
      }
      setValues(processed);
      setLoadState('idle');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'failed to load note');
      setLoadState('error');
    }
  }, []);

  // Auto-load when date changes
  useEffect(() => {
    void loadNote(date);
  }, [date, loadNote]);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function toggleBoolean(key: string) {
    haptic('tap');
    const current = values[key];
    setValue(key, current === 'true' ? 'false' : 'true');
  }

  function pickRating(key: string, val: string) {
    haptic('tap');
    setValue(key, values[key] === val ? '' : val);
  }

  const RATING_EMOJIS = new Set(['🟩', '🟨', '🟥']);

  async function handleSave() {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const merged: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        if (key.endsWith('_note')) continue;
        const note = values[`${key}_note`];
        if (note && RATING_EMOJIS.has(val)) {
          merged[key] = `${val} ${note}`;
        } else {
          merged[key] = val;
        }
      }
      await saveDailyNote(date, merged);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'save failed');
      setSaveStatus('error');
    }
  }

  if (schemaError) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title="Daily Note" />
        <div className="rounded-xl border border-rose-800 bg-rose-900/20 px-4 py-3 text-sm text-rose-300">
          Schema error: {schemaError}
        </div>
      </section>
    );
  }

  if (!schema) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title="Daily Note" />
        <div className="text-sm text-slate-500">Loading schema…</div>
      </section>
    );
  }

  const boolFields = schema.filter((f) => f.type === 'boolean');
  const ratingFields = schema.filter((f) => f.type === 'rating');
  const numberFields = schema.filter((f) => f.type === 'number');
  const textFields = schema.filter((f) => f.type === 'text');

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Daily Note" />

      {/* Date picker */}
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-slate-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-base text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        {loadState === 'error' && (
          <div className="text-xs text-rose-400">{loadError}</div>
        )}
        {loadState === 'loading' && (
          <div className="text-xs text-slate-500">Loading…</div>
        )}
      </div>

      {/* Habits — boolean fields */}
      {boolFields.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">Habits</span>
          <div className="flex flex-wrap gap-2">
            {boolFields.map((f) => {
              const checked = values[f.key] === 'true';
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleBoolean(f.key)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition active:scale-95',
                    checked
                      ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                  ].join(' ')}
                >
                  {checked ? '✓ ' : ''}{f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Meals — rating fields */}
      {ratingFields.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">Meals</span>
          <div className="flex flex-col gap-3">
            {ratingFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-20 text-sm capitalize text-slate-300">{f.label}</span>
                  <div className="flex gap-2">
                    {RATING_OPTIONS.map((opt) => {
                      const active = values[f.key] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-label={`${f.label} ${opt.label}`}
                          onClick={() => pickRating(f.key, opt.value)}
                          className={[
                            'flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition active:scale-95',
                            active
                              ? 'border-slate-400 bg-slate-700'
                              : 'border-slate-800 bg-slate-900 opacity-40 hover:opacity-70',
                          ].join(' ')}
                        >
                          {opt.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  type="text"
                  value={values[`${f.key}_note`] ?? ''}
                  onChange={(e) => setValue(`${f.key}_note`, e.target.value)}
                  placeholder={`What did you eat for ${f.label.toLowerCase()}?`}
                  className="ml-[5.75rem] rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body — number fields */}
      {numberFields.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">Body</span>
          <div className="flex flex-col gap-2">
            {numberFields.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="w-20 text-sm capitalize text-slate-300">{f.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  placeholder="—"
                  className="w-28 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                {f.key === 'weight' && (
                  <span className="text-xs text-slate-500">kg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text fields (future) */}
      {textFields.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">Notes</span>
          <div className="flex flex-col gap-2">
            {textFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs capitalize text-slate-400">{f.label}</label>
                <input
                  type="text"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <SubmitButton
        label="Save to Vault"
        onSubmit={() => void handleSave()}
        disabled={saveStatus === 'saving'}
        status={saveStatus === 'saving' ? 'sending' : saveStatus === 'saved' ? 'sent' : 'idle'}
        error={saveError}
      />
      <StatusLine
        status={saveStatus === 'saving' ? 'sending' : saveStatus === 'saved' ? 'sent' : 'idle'}
        sentLabel="Saved to vault ✓"
      />
    </section>
  );
}
