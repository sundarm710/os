import { useEffect, useRef, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { newClientId } from '../../lib/queue';
import { sendChat, checkChatStatus, type ChatMessage } from '../../lib/chat';
import { loadThread, saveThread, subscribeThread } from '../../lib/chatThread';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadThread);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Background recovery (useChatRecovery, mounted in App) can resolve a
  // message while this page isn't mounted — subscribe so remounting always
  // shows the latest state instead of what was true when we last unmounted.
  useEffect(() => subscribeThread(setMessages), []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function appendUser(text: string): ChatMessage {
    const clientId = newClientId();
    const now = Date.now();
    const msg: ChatMessage = {
      id: clientId,
      role: 'user',
      text,
      at: now,
      pending: true,
      retries: 0,
      sentAt: now,
    };
    saveThread([...loadThread(), msg]);
    return msg;
  }

  function resolve(userMsgId: string, reply: { text: string; failed?: boolean }) {
    const thread = loadThread();
    const next = thread.map((m) => (m.id === userMsgId ? { ...m, pending: false } : m));
    next.push({
      id: userMsgId + (reply.failed ? ':e' : ':r'),
      role: 'assistant',
      text: reply.text,
      at: Date.now(),
      failed: reply.failed,
    });
    saveThread(next);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);

    const userMsg = appendUser(text);
    const result = await sendChat(userMsg.text, userMsg.id);

    if (result.status === 'ok') {
      resolve(userMsg.id, { text: result.reply });
    } else if (result.status === 'error') {
      resolve(userMsg.id, { text: '⚠️ ' + result.error, failed: true });
    }
    // status === 'unknown' (the app was backgrounded mid-request, or the
    // connection just blipped): leave the message pending. It renders as
    // "still working" below, and useChatRecovery resolves it in the
    // background — via a status check first, a resend only if genuinely
    // needed — whether or not this page stays open.

    setSending(false);
    inputRef.current?.focus();
  }

  async function retryNow(msg: ChatMessage) {
    const patched = { ...msg, sentAt: Date.now(), retries: (msg.retries ?? 0) + 1 };
    saveThread(loadThread().map((m) => (m.id === msg.id ? patched : m)));
    const status = await checkChatStatus(msg.id);
    if (status.status === 'ok') {
      resolve(msg.id, { text: status.reply });
      return;
    }
    const result = await sendChat(msg.text, msg.id);
    if (result.status === 'ok') resolve(msg.id, { text: result.reply });
    else if (result.status === 'error') resolve(msg.id, { text: '⚠️ ' + result.error, failed: true });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  const stillStuck = (m: ChatMessage) =>
    m.pending && (m.retries ?? 0) >= 2 && Date.now() - (m.sentAt ?? m.at) > 200_000;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-1 text-2xl font-bold text-slate-100">Assistant</h1>
      <p className="mb-4 text-sm text-slate-400">
        Tasks, notes, German, or “what should I do now?”
      </p>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            Ask me anything — I can read your tasks and notes, add or complete tasks, and nudge
            your German prep. Try “what’s due today?”
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div
              className={
                m.role === 'user'
                  ? 'ml-8 rounded-2xl rounded-br-md bg-emerald-900/40 px-4 py-3'
                  : `mr-4 rounded-2xl rounded-bl-md border border-slate-800 px-4 py-3 ${
                      m.failed ? 'bg-rose-950/40' : 'bg-slate-900'
                    }`
              }
            >
              {m.role === 'assistant' ? (
                <Markdown text={m.text} className="text-sm text-slate-200" />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-100">{m.text}</p>
              )}
            </div>
            {m.role === 'user' && m.pending && (
              <div className="ml-8 mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="animate-pulse">
                  {stillStuck(m) ? 'Taking longer than usual…' : 'Still working — will update automatically'}
                </span>
                {stillStuck(m) && (
                  <button
                    onClick={() => void retryNow(m)}
                    className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-slate-500"
                  >
                    Check now
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-20 mt-2 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={4000}
          placeholder="Message…"
          className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none"
        />
        <button
          onClick={() => void handleSend()}
          disabled={sending || !draft.trim()}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
