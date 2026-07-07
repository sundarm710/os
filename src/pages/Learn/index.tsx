// Learn page entry. Loads the topic list, persists the last selected topic,
// and delegates everything else to TopicView.

import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { useTopics } from '../../lib/useLearning';
import { readString, writeString } from '../../lib/storage';
import { TopicTabs } from './TopicTabs';
import { TopicView } from './TopicView';

const LAST_TOPIC_KEY = 'learnLastTopicSlug';

export default function Learn() {
  const topics = useTopics();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    if (topics.status !== 'ready') return;
    if (topics.data.length === 0) {
      setActiveSlug(null);
      return;
    }
    const remembered = readString(LAST_TOPIC_KEY);
    const exists = remembered && topics.data.some((t) => t.slug === remembered);
    setActiveSlug(exists ? remembered : topics.data[0]!.slug);
  }, [topics.status]);

  function changeTopic(slug: string) {
    setActiveSlug(slug);
    writeString(LAST_TOPIC_KEY, slug);
  }

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Learn" meta={topics.status === 'ready' ? `${topics.data.length} topics` : null} />

      {topics.status === 'loading' && (
        <p className="text-xs text-slate-500">Loading topics…</p>
      )}
      {topics.status === 'error' && (
        <p className="text-xs text-rose-400">{topics.error}</p>
      )}
      {topics.status === 'ready' && topics.data.length === 0 && (
        <p className="text-xs text-slate-500">
          No topics yet. Create one in <code>970 Learning/</code> on the vault.
        </p>
      )}

      {topics.status === 'ready' && topics.data.length > 0 && (
        <>
          <TopicTabs topics={topics.data} activeSlug={activeSlug} onChange={changeTopic} />
          {activeSlug && <TopicView slug={activeSlug} />}
        </>
      )}
    </section>
  );
}
