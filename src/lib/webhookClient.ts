// Generic webhook POST. Knows about auth + JSON, knows nothing about flows.
// All flow-specific clients (postJournal, postCalendar) compose this.

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
  // Read at call time (not module load) so tests can stub via vi.stubEnv.
  return import.meta.env.VITE_AUTH_TOKEN ?? '';
}

export async function postJson<TPayload>(url: string, payload: TPayload): Promise<Response> {
  if (!url) throw new Error('Webhook URL is empty — check VITE_WEBHOOK_* env vars');
  const token = readAuthToken();
  if (!token) throw new Error('Missing VITE_AUTH_TOKEN');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new WebhookError(res.status, body);
  }
  return res;
}
