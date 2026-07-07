// React hooks wrapping LearningService. Components never call the service
// directly — they consume hooks, which centralise loading/error state.

import { useCallback, useEffect, useState } from 'react';
import {
  learningService,
  type ConceptState,
  type DialogueRequest,
  type DialogueResponse,
  type ResourceEntry,
  type TopicDetail,
  type TopicSummary,
  type TranscriptEntry,
} from './learning';

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T };

function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });

  const run = useCallback(() => {
    setState({ status: 'loading' });
    loader()
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: unknown) =>
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run } as AsyncState<T> & { reload: () => void };
}

export function useTopics() {
  return useAsync<TopicSummary[]>(() => learningService.listTopics(), []);
}

export function useTopic(slug: string | null) {
  return useAsync<TopicDetail | null>(
    () => (slug ? learningService.getTopic(slug) : Promise.resolve(null)),
    [slug],
  );
}

export function useState_(slug: string | null) {
  return useAsync<ConceptState[]>(
    () => (slug ? learningService.getState(slug) : Promise.resolve([])),
    [slug],
  );
}

export function useTranscript(slug: string | null, limit = 20) {
  return useAsync<TranscriptEntry[]>(
    () => (slug ? learningService.getTranscript(slug, limit) : Promise.resolve([])),
    [slug, limit],
  );
}

export function useResources(slug: string | null) {
  return useAsync<ResourceEntry[]>(
    () => (slug ? learningService.getResources(slug) : Promise.resolve([])),
    [slug],
  );
}

// Dialogue is request/response, not pull-on-mount — exposes submit() instead.
export function useDialogue() {
  const [last, setLast] = useState<DialogueResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (request: DialogueRequest) => {
    setStatus('sending');
    setError(null);
    try {
      const res = await learningService.submitAnswer(request);
      setLast(res);
      setStatus('idle');
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      throw e;
    }
  }, []);

  return { submit, last, status, error };
}
