import { useEffect, useRef, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { newClientId } from '../../lib/queue';
import { sendChat, type ChatMessage } from '../../lib/chat';

// Thread survives tab switches (App unmounts pages) via sessionStorage.
// It intentionally resets on a fresh app launch — the server keeps the
// durable history and feeds recent turns back to the agent.
const THREAD_KEY = 'chat:thread:v1';

function loadThread(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    // A pending message from a previous mount can never resolve — mark failed.
    return parsed.map((m) => (m.pending ? { ...m, pending: false, failed: true } : m));
  } catch {
    return [];
  }
}

function saveThread(msgs: ChatMessage[]) {
  try {
    sessionStorage.setItem(THREAD_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {
    /* storage full — thread is a convenience, not a record */
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadThread);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => saveThread(messages), [messages]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy) return;

    const clientId = newClientId();
    const userMsg: ChatMessage = { id: clientId, role: 'user', text, at: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setDraft('');
    setBusy(true);

    const result = await sendChat(text, clientId);
    setMessages((m) => [
      ...m,
      'reply' in result
        ? { id: clientId + ':r', role: 'assistant', text: result.reply, at: Date.now() }
        : {
            id: clientId + ':e',
            role: 'assistant',
            text: '⚠️ ' + result.error,
            at: Date.now(),
            failed: true,
          },
    ]);
    setBusy(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

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
          <div
            key={m.id}
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
        ))}
        {busy && (
          <div className="mr-4 rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="animate-pulse text-sm text-slate-400">
              Thinking — may check your tasks or notes, usually 10–40s…
            </p>
          </div>
        )}
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
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
