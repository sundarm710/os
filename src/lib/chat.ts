// Client for the SO-Agent-Chat webhook — the assistant front door.
// Mirrors learning.ts's long-request handling: the agent may run tools
// server-side, so the timeout matches the Socratic dialogue path.

import { postJson } from './webhookClient';

const CHAT_URL = import.meta.env.VITE_WEBHOOK_CHAT_URL;
const CHAT_TIMEOUT_MS = 180_000;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number; // epoch ms
  pending?: boolean;
  failed?: boolean;
}

interface ChatOk {
  ok: true;
  payload: { reply: string; model: string };
}
interface ChatErr {
  ok: false;
  reason?: string;
}

export async function sendChat(
  message: string,
  clientId: string,
): Promise<{ reply: string } | { error: string }> {
  try {
    const res = await postJson(
      CHAT_URL,
      { message, client_id: clientId },
      { timeoutMs: CHAT_TIMEOUT_MS },
    );
    const data = (await res.json()) as ChatOk | ChatErr;
    if (data && data.ok) return { reply: data.payload.reply };
    return { error: (data && 'reason' in data && data.reason) || 'The assistant could not reply.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' };
  }
}
