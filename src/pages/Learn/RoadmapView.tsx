import type { TopicDetail } from '../../lib/learning';

type Props = { topic: TopicDetail };

const STATUS_STYLES: Record<string, string> = {
  'not started':  'border-slate-800 bg-slate-900/40 text-slate-400',
  'in progress':  'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  'done':         'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200',
};

export function RoadmapView({ topic }: Props) {
  if (!topic.roadmap || topic.roadmap.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No modules seeded in Postgres for this topic yet. The roadmap may exist
        in the vault (<code>_topic.md</code> / <code>_roadmap-*.md</code>) but
        hasn't been persisted to <code>learning_modules</code>.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {topic.roadmap.map((m) => {
        const isCurrent = m.module_num === topic.current_module;
        const statusKey = STATUS_STYLES[m.status] ?? STATUS_STYLES['not started']!;
        return (
          <li
            key={m.module_num}
            className={[
              'rounded-xl border px-4 py-3 transition',
              isCurrent ? 'border-emerald-400 bg-emerald-400/5 ring-1 ring-emerald-400/30' : statusKey,
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                  {String(m.module_num).padStart(2, '0')}
                </span>
                <span>{m.name}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{m.status}</span>
            </div>
            <p className="mt-1.5 text-xs italic text-slate-400">{m.why}</p>
            {m.spine_preview && (
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="text-slate-600">spine: </span>
                {m.spine_preview}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
