// Single-topic container. Sub-views are config-driven via SUBVIEWS — adding a
// new sub-view (e.g. an Anki export tab) is one entry in the array.

import { useState, type ComponentType } from 'react';
import { useTopic } from '../../lib/useLearning';
import type { TopicDetail } from '../../lib/learning';
import { DialogueView } from './DialogueView';
import { RoadmapView } from './RoadmapView';
import { ResourcesView } from './ResourcesView';
import { StateView } from './StateView';

type Props = { slug: string };

type SubView = {
  id: string;
  label: string;
  render: (ctx: { slug: string; topic: TopicDetail }) => JSX.Element;
};

const SUBVIEWS: SubView[] = [
  { id: 'dialogue',  label: 'Dialogue',  render: ({ topic })       => <DialogueView topic={topic} /> },
  { id: 'roadmap',   label: 'Roadmap',   render: ({ topic })       => <RoadmapView topic={topic} /> },
  { id: 'state',     label: 'State',     render: ({ slug })        => <StateView slug={slug} /> },
  { id: 'resources', label: 'Resources', render: ({ slug })        => <ResourcesView slug={slug} /> },
];

const STATUS_DOT: Record<TopicDetail['status'], string> = {
  'roadmap-draft':    'bg-amber-400',
  'roadmap-accepted': 'bg-sky-400',
  'active':           'bg-emerald-400',
  'in-progress':      'bg-emerald-400',
  'apex-defended':    'bg-fuchsia-400',
};

export function TopicView({ slug }: Props) {
  const t = useTopic(slug);
  const [subview, setSubview] = useState<string>(SUBVIEWS[0]!.id);

  if (t.status === 'loading' || t.status === 'idle') {
    return <p className="text-xs text-slate-500">Loading topic…</p>;
  }
  if (t.status === 'error') {
    return <p className="text-xs text-rose-400">{t.error}</p>;
  }
  if (!t.data) return null;
  const topic = t.data;

  const active = SUBVIEWS.find((s) => s.id === subview) ?? SUBVIEWS[0]!;
  const Render = active.render as ComponentType<{ slug: string; topic: TopicDetail }>;

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
          <span
            aria-hidden
            className={['inline-block h-1.5 w-1.5 rounded-full', STATUS_DOT[topic.status]].join(' ')}
          />
          <span>{topic.status}</span>
          <span className="text-slate-700">·</span>
          <span>module {String(topic.current_module).padStart(2, '0')}</span>
          <span className="text-slate-700">·</span>
          <span>threshold {topic.advance_threshold}</span>
        </div>
        <h2 className="text-base font-semibold text-slate-100">{topic.title}</h2>
        <p className="text-xs italic text-slate-400">{topic.apex}</p>
      </header>

      <nav
        role="tablist"
        aria-label="Topic views"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1"
      >
        {SUBVIEWS.map((s) => {
          const a = s.id === subview;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={a}
              onClick={() => setSubview(s.id)}
              className={[
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95',
                a
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700',
              ].join(' ')}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <Render slug={slug} topic={topic} />
    </article>
  );
}
