// Generic webhook POST. Knows about auth + JSON, knows nothing about flows.
// All flow-specific clients (postJournal, postCalendar) compose this.

import { getAuthToken, clearAuthToken, notifyAuthInvalid } from './auth';

// Hard cap on every webhook request. Without this, a hung n8n branch or an
// iOS-suspended fetch can leave useTasks/useCalendarEvents stuck on
// loading=true forever — the "Refreshing…" indicator never clears because
// the await never resolves. Picking 15s: long enough to ride out a slow
// VPS cold-start, short enough that a stuck request fails gracefully.
const DEFAULT_TIMEOUT_MS = 15_000;

export class WebhookError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Webhook ${status}: ${body}`);
    this.name = 'WebhookError';
  }
}

function readAuthToken(): string {
  // Read at call time (not module load): the token comes from the LoginGate
  // (localStorage) with a dev/test env fallback. See lib/auth.ts.
  return getAuthToken();
}

export async function postJson<TPayload>(
  url: string,
  payload: TPayload,
  options?: { timeoutMs?: number },
): Promise<Response> {
  // Callers needing more than the default (e.g. SO-Learn answer waits on a
  // Claude Sonnet call that routinely runs 20–40s) pass `timeoutMs` explicitly.
  if (!url) throw new Error('Webhook URL is empty — check VITE_WEBHOOK_* env vars');
  const token = readAuthToken();
  if (!token) throw new Error('Missing auth token — log in again');

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // A rejected token means the stored value is wrong/stale — drop it and
      // signal LoginGate so the user is prompted to re-enter, rather than
      // letting every page silently fail with the same bad token.
      if (res.status === 401 || res.status === 403) {
        clearAuthToken();
        notifyAuthInvalid();
      }
      throw new WebhookError(res.status, body);
    }
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
