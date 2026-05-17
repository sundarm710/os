import { useCallback, useState } from 'react';
import { enqueue, newClientId, type QueuedEntry } from './queue';
import { drainQueue } from './sync';
import { haptic } from './haptic';

export type SubmissionStatus = 'idle' | 'sending' | 'sent' | 'queued' | 'error';

const RESET_DELAY_MS = 1500;

export type UseSubmissionResult<TPayload extends { client_id: string }> = {
  status: SubmissionStatus;
  error: string | null;
  // buildPayload may optionally include a client_id (edit flow); when omitted
  // a fresh UUID is generated. Reusing an existing client_id turns the POST
  // into an UPSERT on the server.
  submit: (
    buildPayload: () =>
      | Omit<TPayload, 'client_id'>
      | (Omit<TPayload, 'client_id'> & { client_id: string }),
  ) => Promise<void>;
  reset: () => void;
};

/**
 * Shared submission lifecycle for capture flows. Owns the enqueue + drain +
 * status state machine; pages own form state only.
 *
 * Flow:
 * 1. caller invokes submit(buildPayload)
 * 2. hook generates client_id and enqueues durably
 * 3. hook fires drainQueue() — synchronously awaited so status reflects outcome
 * 4. status: 'sent' if drain succeeded, 'queued' if drain failed (entry still
 *    persisted), 'error' only if enqueue itself blew up
 * 5. status auto-resets to 'idle' after RESET_DELAY_MS
 */
export function useSubmission<TPayload extends { client_id: string }>(
  type: QueuedEntry['type'],
): UseSubmissionResult<TPayload> {
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const submit = useCallback<UseSubmissionResult<TPayload>['submit']>(
    async (buildPayload) => {
      if (status === 'sending') return;

      setStatus('sending');
      setError(null);
      haptic('submitStart');

      const built = buildPayload() as Partial<TPayload>;
      const payload = { client_id: newClientId(), ...built } as TPayload;

      try {
        await enqueue(type, payload);
        const { sent, failed } = await drainQueue();

        if (failed === 0 && sent > 0) {
          setStatus('sent');
          haptic('successRamp');
        } else {
          setStatus('queued');
        }

        setTimeout(reset, RESET_DELAY_MS);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Could not save');
      }
    },
    [type, status, reset],
  );

  return { status, error, submit, reset };
}
