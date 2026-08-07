import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type AddTaskParams } from '../lib/useTasks';
import { parseTaskInput } from '../lib/taskInput';
import { haptic } from '../lib/haptic';

export type OmnibarHandle = { focus: () => void };

interface Props {
  projects: string[] | null;
  onAdd: (params: AddTaskParams) => Promise<void>;
}

// Persistent desktop quick-add bar. Type a task with inline tokens
// (#project @date ~est *repeat), Enter to create. The bar stays focused and
// clears after each add so tasks can be fired off one after another.
export const TaskOmnibar = forwardRef<OmnibarHandle, Props>(function TaskOmnibar(
  { projects, onAdd },
  ref,
) {
  const [text, setText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [flash, setFlash] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  // Re-parse on every keystroke for the live preview. `now` is read fresh here
  // (not memo-pinned) so a bar left open across midnight resolves @today
  // correctly — the cost is negligible.
  const parsed = useMemo(
    () => parseTaskInput(text, projects),
    [text, projects],
  );
  const canSubmit =
    !submitting && parsed.params.text.length > 0 && parsed.errors.length === 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    haptic('submitStart');
    try {
      await onAdd(parsed.params);
      haptic('successRamp');
      setText('');
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
    } catch {
      // Error surfaces in the page banner via useTasks; keep the text so the
      // user can retry or edit.
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  const p = parsed.preview;
  const hasPreview =
    p.project || p.dueLabel || p.est || p.recurLabel;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={[
          'flex items-center gap-2 rounded-xl border bg-slate-900 px-3 py-2 transition',
          flash
            ? 'border-emerald-400'
            : 'border-slate-800 focus-within:border-emerald-400',
        ].join(' ')}
      >
        <span className="select-none text-sm text-slate-600">⌘</span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            } else if (e.key === 'Escape') {
              e.currentTarget.blur();
            }
          }}
          placeholder="Add a task…  #project @tomorrow ~30m *weekly"
          maxLength={280}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        {flash && <span className="text-xs font-medium text-emerald-300">Added ✓</span>}
      </div>

      {/* Live preview / errors — only while typing. */}
      {text.trim().length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px]">
          {parsed.errors.length > 0 ? (
            <span className="text-rose-400">{parsed.errors.join(' · ')}</span>
          ) : (
            <>
              <span className="text-slate-400">
                {parsed.params.text || <span className="italic text-slate-600">title…</span>}
              </span>
              {hasPreview && <span className="text-slate-700">·</span>}
              {p.project && <PreviewChip>{p.project}</PreviewChip>}
              {p.dueLabel && <PreviewChip tone="emerald">{p.dueLabel}</PreviewChip>}
              {p.est && <PreviewChip>{p.est}</PreviewChip>}
              {p.recurLabel && <PreviewChip>🔁 {p.recurLabel}</PreviewChip>}
            </>
          )}
        </div>
      )}
    </div>
  );
});

function PreviewChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'emerald';
}) {
  return (
    <span
      className={[
        'rounded-full border px-1.5 py-0',
        tone === 'emerald'
          ? 'border-emerald-700/60 text-emerald-300'
          : 'border-slate-700 text-slate-400',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
