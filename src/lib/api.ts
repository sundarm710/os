// Webhook client. Stays a thin POST wrapper; queue + drain logic lives in
// src/lib/queue.ts and src/lib/sync.ts.

export type MoodPayload = {
  client_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string | null;
  client_timestamp: string;
};

const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;

export async function postMood(payload: MoodPayload): Promise<void> {
  if (!WEBHOOK_URL || !AUTH_TOKEN) {
    throw new Error('Missing VITE_WEBHOOK_URL or VITE_AUTH_TOKEN in env');
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': AUTH_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook ${res.status}: ${await res.text().catch(() => '')}`);
  }
}
