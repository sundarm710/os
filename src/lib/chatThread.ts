// Shared chat-thread storage + a tiny pub/sub so the Chat page (which
// unmounts on every tab switch — see App.tsx) and the background recovery
// hook (which stays mounted, see useChatRecovery) can both read/write the
// same thread and stay in sync without a full state-management library.

import type { ChatMessage } from './chat';

const THREAD_KEY = 'chat:thread:v1';
const MAX_MESSAGES = 60;

type Listener = (msgs: ChatMessage[]) => void;
const listeners = new Set<Listener>();

export function loadThread(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveThread(msgs: ChatMessage[]): void {
  const trimmed = msgs.slice(-MAX_MESSAGES);
  try {
    sessionStorage.setItem(THREAD_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full — thread is a convenience, not a record */
  }
  listeners.forEach((fn) => fn(trimmed));
}

export function subscribeThread(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pendingMessages(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.filter((m) => m.role === 'user' && m.pending);
}
