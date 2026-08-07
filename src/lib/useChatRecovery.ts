import { useEffect, useRef } from 'react';
import { checkChatStatus, sendChat, type ChatMessage } from './chat';
import { loadThread, saveThread, pendingMessages } from './chatThread';

// Resend only once we're sure the original server-side run has finished one
// way or another: call-claude-agent.js times out at 170s, plus n8n/network
// overhead — 200s is a safe floor. Below that we just keep checking status.
const RESEND_AFTER_MS = 200_000;
const MAX_RETRIES = 2;

// Mounted once at the App level (not inside the Chat page, which unmounts
// on every tab switch) so a message sent right before backgrounding still
// gets recovered even if the user never reopens the Chat tab before the
// server responds — the reply is captured into the thread either way.
export function useChatRecovery() {
  const runningRef = useRef(false);

  useEffect(() => {
    const recover = async () => {
      if (runningRef.current) return;
      const pending = pendingMessages(loadThread());
      if (pending.length === 0) return;
      runningRef.current = true;
      try {
        for (const msg of pending) {
          await recoverOne(msg);
        }
      } finally {
        runningRef.current = false;
      }
    };

    void recover();
    const onOnline = () => void recover();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void recover();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

async function recoverOne(msg: ChatMessage): Promise<void> {
  const status = await checkChatStatus(msg.id);

  if (status.status === 'ok') {
    resolveMessage(msg.id, { role: 'assistant', text: status.reply });
    return;
  }

  if (status.status === 'error') {
    resolveMessage(msg.id, { role: 'assistant', text: '⚠️ ' + status.error, failed: true });
    return;
  }

  // Still pending server-side (or the status check itself was network-killed).
  const age = Date.now() - (msg.sentAt ?? msg.at);
  const retries = msg.retries ?? 0;
  if (age < RESEND_AFTER_MS || retries >= MAX_RETRIES) return;

  const now = Date.now();
  patchMessage(msg.id, { sentAt: now, retries: retries + 1 });
  const result = await sendChat(msg.text, msg.id);
  if (result.status === 'ok') {
    resolveMessage(msg.id, { role: 'assistant', text: result.reply });
  } else if (result.status === 'error') {
    resolveMessage(msg.id, { role: 'assistant', text: '⚠️ ' + result.error, failed: true });
  }
  // status === 'unknown': leave pending, the next foreground/online pass retries.
}

function patchMessage(id: string, patch: Partial<ChatMessage>) {
  const thread = loadThread();
  saveThread(thread.map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

function resolveMessage(
  id: string,
  reply: { role: 'assistant'; text: string; failed?: boolean },
) {
  const thread = loadThread();
  const next = thread.map((m) => (m.id === id ? { ...m, pending: false } : m));
  next.push({
    id: id + (reply.failed ? ':e' : ':r'),
    role: reply.role,
    text: reply.text,
    at: Date.now(),
    failed: reply.failed,
  });
  saveThread(next);
}
