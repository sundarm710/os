import { useRef } from 'react';
import { haptic } from '../lib/haptic';

type Props = {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
  /** Whether the dial can decrement further (e.g. duration at 15 min). */
  canDecrement?: boolean;
  /** Whether the dial can increment further (always true for time/duration). */
  canIncrement?: boolean;
  disabled?: boolean;
};

const STEP_PX = 28; // horizontal pixels per click; tuned for thumb drag

/**
 * Touch dial. The whole row is the control — drag horizontally to step the
 * value (no buttons, no thumb-reach asymmetry). Haptic ticks on each step.
 *
 * Direction-only API: parent decides the magnitude (e.g. 15 min) so this
 * component stays generic and reusable.
 */
export function DialRow({
  label,
  value,
  onStep,
  canDecrement = true,
  canIncrement = true,
  disabled = false,
}: Props) {
  const startX = useRef<number | null>(null);
  const lastStepIndex = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    startX.current = e.clientX;
    lastStepIndex.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    const stepIndex = Math.round(delta / STEP_PX);
    if (stepIndex === lastStepIndex.current) return;

    const direction: 1 | -1 = stepIndex > lastStepIndex.current ? 1 : -1;
    const wouldGoBackward = direction === -1;
    const wouldGoForward = direction === 1;

    if ((wouldGoBackward && !canDecrement) || (wouldGoForward && !canIncrement)) {
      // Block further moves in the disallowed direction without losing state —
      // user can drag back into the allowed direction.
      lastStepIndex.current = stepIndex;
      return;
    }

    onStep(direction);
    haptic('tap');
    lastStepIndex.current = stepIndex;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    startX.current = null;
    lastStepIndex.current = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuetext={value}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'none', userSelect: 'none' }}
      className={[
        'select-none rounded-xl border bg-slate-900 px-4 py-3',
        disabled
          ? 'border-slate-800 opacity-60'
          : 'border-slate-800 active:border-emerald-500/60',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-xs text-slate-600">drag to adjust</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span
          aria-hidden
          className={[
            'text-lg leading-none',
            canDecrement && !disabled ? 'text-slate-500' : 'text-slate-700',
          ].join(' ')}
        >
          ◀
        </span>
        <span className="text-2xl font-semibold tabular-nums text-slate-100">
          {value}
        </span>
        <span
          aria-hidden
          className={[
            'text-lg leading-none',
            canIncrement && !disabled ? 'text-slate-500' : 'text-slate-700',
          ].join(' ')}
        >
          ▶
        </span>
      </div>
    </div>
  );
}
