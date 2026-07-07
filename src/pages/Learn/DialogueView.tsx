// Where the actual learning happens on the PWA. Pulls the most-recent transcript
// entry as the current prompt; sends the user's answer; renders the assessment
// inline; advances to the next prompt.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogue, useTranscript } from '../../lib/useLearning';
import type { Level, TopicDetail, TranscriptEntry } from '../../lib/learning';
import { SubmitButton } from '../../components/SubmitButton';
import { Markdown } from '../../components/Markdown';

type Props = { topic: TopicDetail };

const LEVEL_COLOR: Record<Level, string> = {
  L1: 'text-rose-300',
  L2: 'text-amber-300',
  L3: 'text-sky-300',
  L4: 'text-emerald-300',
  L5: 'text-fuchsia-300',
};

const CONF_LABELS = ['no idea', 'unsure', 'middling', 'fairly sure', 'certain'];

function currentPrompt(transcript: TranscriptEntry[]): string {
  // Last entry's claude_prompt is what the user is currently being asked.
  const last = transcript[0];
  return last?.claude_prompt ?? '';
}

export function DialogueView({ topic }: Props) {
  const transcript = useTranscript(topic.slug, 20);
  const { submit, last, status, error } = useDialogue();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When a fresh dialogue response lands, clear input and reload transcript.
  // Exception: on a parse-failed response we leave the textarea populated so
  // the user can re-submit the exact same answer (the client_id ref also
  // survives so the retry deduplicates server-side).
  useEffect(() => {
    if (!last) return;
    transcript.reload();
    if (last.last_assessment?.action !== 'parse-failed') {
      setText('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // Prompt resolution, in priority order:
  //   1. Fresh in-memory next_prompt from this session's last submit.
  //   2. Persistent open_prompt on the topic — set by whichever Claude turn
  //      most recently spoke (PWA workflow OR Claude Code surface). This is
  //      what makes cross-device handoff work: open the PWA after a Claude
  //      Code session and you see the live question, not the last answered one.
  //   3. Last transcript entry's claude_prompt — legacy fallback, used only
  //      when open_prompt has never been set on this topic (cold-start).
  const prompt = useMemo(() => {
    if (last?.next_prompt) return last.next_prompt;
    if (topic.open_prompt) return topic.open_prompt;
    if (transcript.status === 'ready') return currentPrompt(transcript.data);
    return '';
  }, [last, topic.open_prompt, transcript]);

  const canSubmit = text.trim().length > 0 && status !== 'sending';

  // Show the explanation context that came with the current open_prompt.
  // After a PWA submit, `last.claude_message` is already in the assessment box,
  // so we only surface transcript context on cold-start (no `last` yet).
  const coldStartContext = useMemo(() => {
    if (last) return null;
    if (transcript.status !== 'ready') return null;
    return transcript.data[0]?.claude_message ?? null;
  }, [last, transcript]);

  // Set in handleSubmit, cleared on success. Retries reuse the same UUID so the
  // server's UNIQUE(client_id) deduplicates instead of inserting twice.
  const clientIdRef = useRef<string | null>(null);

  // Pre-submit confidence rating (1..5). Defaults to neutral 3 each turn.
  // Drives the SM-2 spaced-retrieval quality calibration server-side.
  const [confidence, setConfidence] = useState<number>(3);

  async function handleSubmit() {
    if (!canSubmit) return;
    const client_id = clientIdRef.current ?? crypto.randomUUID();
    clientIdRef.current = client_id;
    try {
      await submit({
        topic_slug: topic.slug,
        surface: 'pwa',
        user_response: text.trim(),
        client_id,
        confidence,
      });
      clientIdRef.current = null;
      setConfidence(3);
    } catch {
      // Keep clientIdRef set so the next retry deduplicates.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          Module {String(topic.current_module).padStart(2, '0')} ·{' '}
          {topic.current_concept ?? '—'}
        </span>
        {coldStartContext && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <Markdown text={coldStartContext} />
          </div>
        )}
        {prompt ? (
          <div className="text-sm text-slate-100">
            <Markdown text={prompt} />
          </div>
        ) : (
          <span className="text-sm italic text-slate-500">
            No active prompt yet. Type something to begin — the workflow will open Module 1.
          </span>
        )}
      </header>

      {status === 'sending' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Claude is thinking — usually 20–40s. Keep this tab open.
        </div>
      )}

      {last?.last_assessment?.action === 'parse-failed' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <div className="font-semibold">Couldn't read Claude's response.</div>
          <p className="mt-1 text-amber-200/80">
            Your answer was saved. The grader returned a malformed reply, so we
            kept the question on screen. Tap submit again to retry — the server
            will dedupe, so no risk of double-counting.
          </p>
        </div>
      )}

      {last?.last_assessment && last.last_assessment.action !== 'parse-failed' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Your last answer assessed at</span>
            <span className={['font-mono font-semibold', LEVEL_COLOR[last.last_assessment.level ?? 'L1']].join(' ')}>
              {last.last_assessment.level ?? '—'}
            </span>
            {last.last_assessment.action && (
              <span className="ml-auto text-slate-500">→ {last.last_assessment.action}</span>
            )}
          </div>
          {last.last_assessment.evidence_quote && (
            <p className="mt-1 border-l-2 border-slate-700 pl-2 text-slate-400">
              <span className="text-slate-500">Evidence: </span>
              <span className="italic">“{last.last_assessment.evidence_quote}”</span>
            </p>
          )}
          {last.last_assessment.diagnosis && (
            <div className="mt-1 italic text-slate-400">
              <Markdown text={last.last_assessment.diagnosis} />
            </div>
          )}
          {last.claude_message && (
            <div className="mt-2 text-slate-300">
              <Markdown text={last.claude_message} />
            </div>
          )}
        </div>
      )}

      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder="Write your answer. Cmd/Ctrl+Enter to submit."
        rows={6}
        maxLength={4000}
        className="resize-y rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{text.length}/4000</span>
      </div>

      {/* Confidence stepper. 1 = no idea, 5 = certain. Drives spaced-retrieval
          quality: high-confidence wrong-answers come back fast (hypercorrection),
          low-confidence-correct ones stretch out. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
          <span>Before submitting — how sure are you?</span>
          <span className="font-mono text-slate-400">{CONF_LABELS[confidence - 1]}</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n === confidence;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setConfidence(n)}
                aria-label={`confidence ${n}`}
                className={[
                  'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95',
                  active
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <SubmitButton
        label="Submit answer"
        onSubmit={() => void handleSubmit()}
        disabled={!canSubmit}
        status={status === 'sending' ? 'sending' : 'idle'}
        error={error}
      />

      <details className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500">
          Recent transcript
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {transcript.status === 'ready' &&
            transcript.data.map((t, i) => (
              <li key={i} className="rounded-lg border border-slate-800/60 px-2 py-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-500">
                  <span>{new Date(t.exchanged_at).toLocaleString()}</span>
                  {t.assessed_level && (
                    <span className={['font-mono', LEVEL_COLOR[t.assessed_level]].join(' ')}>
                      {t.assessed_level}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-slate-400">
                  <span className="text-slate-500">Q: </span>
                  <Markdown text={t.claude_prompt ?? ''} className="inline-block align-top" />
                </div>
                <div className="mt-0.5 text-slate-200">
                  <span className="text-slate-500">A: </span>
                  <Markdown text={t.user_response ?? ''} className="inline-block align-top" />
                </div>
                {t.evidence_quote && (
                  <p className="mt-0.5 border-l-2 border-slate-700 pl-2 italic text-slate-500">
                    “{t.evidence_quote}”
                  </p>
                )}
                {t.diagnosis && (
                  <div className="mt-0.5 italic text-slate-500">
                    <Markdown text={t.diagnosis} />
                  </div>
                )}
                {t.claude_message && (
                  <div className="mt-0.5 text-slate-400">
                    <Markdown text={t.claude_message} />
                  </div>
                )}
              </li>
            ))}
          {transcript.status === 'ready' && transcript.data.length === 0 && (
            <li className="text-xs text-slate-500">No exchanges yet.</li>
          )}
        </ul>
      </details>
    </div>
  );
}
