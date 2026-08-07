// Client for the SO-Agent-Chat webhooks — the assistant front door.
//
// iOS Safari (and most mobile browsers) suspend in-flight fetches when the
// PWA is backgrounded — the connection is killed at the OS level, not by
// our AbortController. The n8n workflow keeps running on the server
// regardless (executeCommand doesn't care that the client vanished), so a
// "NetworkError" here does NOT mean the request failed — it means we don't
// know yet. sendChat() and checkChatStatus() are split so callers can poll
// for the real outcome instead of treating every network hiccup as fatal.

import { postJson } from './webhookClient';

const CHAT_URL = import.meta.env.VITE_WEBHOOK_CHAT_URL;
const CHAT_STATUS_URL = import.meta.env.VITE_WEBHOOK_CHAT_STATUS_URL;
const CHAT_TIMEOUT_MS = 180_000;
const STATUS_TIMEOUT_MS = 12_000;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string; // client_id for user messages; `${client_id}:r`/`:e` for replies
  role: ChatRole;
  text: string;
  at: number; // epoch ms
  pending?: boolean; // user message awaiting a reply (still true across backgrounding)
  failed?: boolean;
  retries?: number; // recovery-driven resend count
  sentAt?: number; // last time we asked the server to run this (for resend gating)
}

interface ApiOk {
  ok: true;
  payload: { reply: string; model: string };
}
interface ApiErr {
  ok: false;
  reason?: string;
}

export type SendResult =
  | { status: 'ok'; reply: string }
  | { status: 'error'; error: string }
  | { status: 'unknown' }; // request may have reached the server; poll to find out

export async function sendChat(message: string, clientId: string): Promise<SendResult> {
  try {
    const res = await postJson(
      CHAT_URL,
      { message, client_id: clientId },
      { timeoutMs: CHAT_TIMEOUT_MS },
    );
    const data = (await res.json()) as ApiOk | ApiErr;
    if (data && data.ok) return { status: 'ok', reply: data.payload.reply };
    return { status: 'error', error: (data && data.reason) || 'The assistant could not reply.' };
  } catch {
    // Network error, abort, or timeout — genuinely ambiguous. Don't surface
    // this as a failure; the caller should poll checkChatStatus instead.
    return { status: 'unknown' };
  }
}

export type StatusResult =
  | { status: 'ok'; reply: string }
  | { status: 'pending' }
  | { status: 'error'; error: string };

export async function checkChatStatus(clientId: string): Promise<StatusResult> {
  try {
    const res = await postJson(
      CHAT_STATUS_URL,
      { client_id: clientId },
      { timeoutMs: STATUS_TIMEOUT_MS },
    );
    const data = (await res.json()) as ApiOk | ApiErr;
    if (data && data.ok) return { status: 'ok', reply: data.payload.reply };
    if (data && data.reason === 'pending') return { status: 'pending' };
    return { status: 'error', error: (data && data.reason) || 'Status check failed.' };
  } catch {
    // Status check itself got network-killed — we still don't know. Treat
    // as pending so the next foreground/online trigger tries again.
    return { status: 'pending' };
  }
}
