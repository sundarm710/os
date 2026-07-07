import { useResources } from '../../lib/useLearning';
import type { ResourceCategory, ResourceEntry, ResourceStatus } from '../../lib/learning';

type Props = { slug: string };

const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  foundational: 'Foundational',
  core:         'Core',
  applied:      'Applied',
  critiques:    'Critiques & limits',
  tangents:     'Tangents',
};

const CATEGORY_ORDER: ResourceCategory[] = [
  'foundational', 'core', 'applied', 'critiques', 'tangents',
];

const STATUS_BADGE: Record<ResourceStatus, string> = {
  queued:   'border-slate-700 text-slate-400',
  reading:  'border-amber-500/50 text-amber-300',
  digested: 'border-emerald-500/50 text-emerald-300',
  parked:   'border-slate-700 text-slate-600',
};

function groupByCategory(rows: ResourceEntry[]): Map<ResourceCategory, ResourceEntry[]> {
  const out = new Map<ResourceCategory, ResourceEntry[]>();
  for (const r of rows) {
    const arr = out.get(r.category) ?? [];
    arr.push(r);
    out.set(r.category, arr);
  }
  return out;
}

export function ResourcesView({ slug }: Props) {
  const r = useResources(slug);

  if (r.status === 'loading' || r.status === 'idle') {
    return <p className="text-xs text-slate-500">Loading resources…</p>;
  }
  if (r.status === 'error') {
    return <p className="text-xs text-rose-400">{r.error}</p>;
  }
  if (r.data.length === 0) {
    return <p className="text-xs text-slate-500">No resources yet.</p>;
  }

  const grouped = groupByCategory(r.data);

  return (
    <div className="flex flex-col gap-4">
      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
        <section key={c} className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-wide text-slate-500">
            {CATEGORY_LABEL[c]}
          </h3>
          <ul className="flex flex-col gap-2">
            {grouped.get(c)!.map((res) => (
              <li
                key={res.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {res.url ? (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-300 underline-offset-2 hover:underline"
                      >
                        {res.title}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-slate-200">{res.title}</span>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                      {res.resource_type && <span>{res.resource_type}</span>}
                      {res.supports_module && <span>mod {res.supports_module}</span>}
                    </div>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] uppercase',
                      STATUS_BADGE[res.status],
                    ].join(' ')}
                  >
                    {res.status}
                  </span>
                </div>
                {res.why_relevant && (
                  <p className="mt-1 text-[11px] italic text-slate-400">{res.why_relevant}</p>
                )}
                {res.note && (
                  <p className="mt-1 text-[11px] text-slate-500">{res.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
