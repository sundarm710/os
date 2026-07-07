import { useState_ } from '../../lib/useLearning';
import type { ConceptState, Level } from '../../lib/learning';

type Props = { slug: string };

const LEVEL_COLOR: Record<Level, string> = {
  L1: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  L2: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  L3: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  L4: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  L5: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40',
};

function groupByModule(rows: ConceptState[]): Map<number, ConceptState[]> {
  const out = new Map<number, ConceptState[]>();
  for (const r of rows) {
    const arr = out.get(r.module_num) ?? [];
    arr.push(r);
    out.set(r.module_num, arr);
  }
  return out;
}

export function StateView({ slug }: Props) {
  const s = useState_(slug);

  if (s.status === 'loading' || s.status === 'idle') {
    return <p className="text-xs text-slate-500">Loading state…</p>;
  }
  if (s.status === 'error') {
    return <p className="text-xs text-rose-400">{s.error}</p>;
  }
  if (s.data.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No concepts gated yet. Start a dialogue session and the first assessment will appear here.
      </p>
    );
  }

  const grouped = groupByModule(s.data);
  const modules = [...grouped.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      {modules.map((moduleNum) => (
        <section key={moduleNum} className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-wide text-slate-500">
            Module {String(moduleNum).padStart(2, '0')}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {grouped.get(moduleNum)!.map((c) => (
              <li
                key={c.concept_slug}
                className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-200">{c.concept_slug}</span>
                  {c.level && (
                    <span
                      className={[
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-mono',
                        LEVEL_COLOR[c.level],
                      ].join(' ')}
                    >
                      {c.level}
                    </span>
                  )}
                </div>
                {c.diagnosis && (
                  <p className="mt-1 text-[11px] italic text-slate-400">{c.diagnosis}</p>
                )}
                {c.evidence && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    <span className="text-slate-600">"</span>
                    {c.evidence}
                    <span className="text-slate-600">"</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
