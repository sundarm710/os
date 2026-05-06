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
  /** Tap on ◀ arrow. If provided, the arrow becomes a button. */
  onLeftEdgeTap?: () => void;
  /** Tap on ▶ arrow. If provided, the arrow becomes a button. */
  onRightEdgeTap?: () => void;
  /** Override the hint shown next to the label. */
  hint?: string;
  disabled?: boolean;
};

const STEP_PX = 28; // horizontal pixels per click; tuned for thumb drag

/**
 * Touch dial. The whole row is the control — drag horizontally to step the
 * value (no buttons, no thumb-reach asymmetry). Haptic ticks on each step.
 *
 * The ◀ / ▶ arrows are decorative by default, but become tappable buttons
 * when `onLeftEdgeTap` / `onRightEdgeTap` are supplied. They stop pointer
 * propagation so taps don't accidentally trigger the drag handler.
 *
 * Direction-only step API: parent decides the magnitude (e.g. 15 min) so this
 * component stays generic and reusable.
 */
export function DialRow({
  label,
  value,
  onStep,
  canDecrement = true,
  canIncrement = true,
  onLeftEdgeTap,
  onRightEdgeTap,
  hint,
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

  const dragHint = hint ?? (onLeftEdgeTap || onRightEdgeTap ? 'drag · tap arrows to snap' : 'drag to adjust');

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
        'select-none rounded-xl border bg-slate-900 px-2 py-3',
        disabled
          ? 'border-slate-800 opacity-60'
          : 'border-slate-800 active:border-emerald-500/60',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-2">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-xs text-slate-600">{dragHint}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <EdgeArrow
          direction="left"
          onTap={onLeftEdgeTap}
          enabled={canDecrement && !disabled}
        />
        <span className="text-2xl font-semibold tabular-nums text-slate-100">
          {value}
        </span>
        <EdgeArrow
          direction="right"
          onTap={onRightEdgeTap}
          enabled={canIncrement && !disabled}
        />
      </div>
    </div>
  );
}

type EdgeArrowProps = {
  direction: 'left' | 'right';
  onTap?: () => void;
  enabled: boolean;
};

function EdgeArrow({ direction, onTap, enabled }: EdgeArrowProps) {
  const glyph = direction === 'left' ? '◀' : '▶';
  const aria = direction === 'left' ? 'Snap to previous' : 'Snap to next';

  if (!onTap) {
    return (
      <span
        aria-hidden
        className={[
          'px-3 text-lg leading-none',
          enabled ? 'text-slate-500' : 'text-slate-700',
        ].join(' ')}
      >
        {glyph}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={aria}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!enabled) return;
        haptic('tap');
        onTap();
      }}
      disabled={!enabled}
      className={[
        'rounded-md px-3 py-1 text-lg leading-none transition active:scale-90',
        enabled
          ? 'text-slate-300 hover:text-emerald-300 active:text-emerald-300'
          : 'text-slate-700',
      ].join(' ')}
    >
      {glyph}
    </button>
  );
}
