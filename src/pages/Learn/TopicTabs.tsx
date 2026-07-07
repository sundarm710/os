// Horizontal topic switcher. Driven entirely by the topics array — adding a
// new topic in the vault automatically produces a new tab here.

import type { TopicSummary } from '../../lib/learning';

type Props = {
  topics: TopicSummary[];
  activeSlug: string | null;
  onChange: (slug: string) => void;
};

const STATUS_DOT: Record<TopicSummary['status'], string> = {
  'roadmap-draft':    'bg-amber-400',
  'roadmap-accepted': 'bg-sky-400',
  'active':           'bg-emerald-400',
  'in-progress':      'bg-emerald-400',
  'apex-defended':    'bg-fuchsia-400',
};

export function TopicTabs({ topics, activeSlug, onChange }: Props) {
  if (topics.length === 0) return null;
  return (
    <div
      role="tablist"
      aria-label="Learning topics"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {topics.map((t) => {
        const active = t.slug === activeSlug;
        return (
          <button
            key={t.slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.slug)}
            className={[
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95',
              active
                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={['mr-1.5 inline-block h-1.5 w-1.5 rounded-full', STATUS_DOT[t.status]].join(' ')}
            />
            {t.title}
          </button>
        );
      })}
    </div>
  );
}
