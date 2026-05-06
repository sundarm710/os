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

const STEP_PX = 24; // vertical pixels per click; tuned for thumb drag

/**
 * Touch dial. The whole row is the control — drag VERTICALLY to step the
 * value. Drag UP to increment, DOWN to decrement; haptic ticks on each step.
 *
 * The ◀ / ▶ arrows are decorative by default, but become tappable buttons
 * when `onLeftEdgeTap` / `onRightEdgeTap` are supplied. They stop pointer
 * propagation so taps don't accidentally trigger the drag handler. They're
 * for discrete snaps (presets / "back to now"), not stepping.
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
  const startY = useRef<number | null>(null);
  const lastStepIndex = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    startY.current = e.clientY;
    lastStepIndex.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    // Up is increment: dragging up means clientY decreases, so flip sign.
    const delta = startY.current - e.clientY;
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
    if (startY.current === null) return;
    startY.current = null;
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
        'flex select-none flex-col gap-2 rounded-xl border bg-slate-900 px-2 pb-3 pt-2',
        disabled
          ? 'border-slate-800 opacity-60'
          : 'border-slate-800 active:border-emerald-500/60',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-xs leading-none text-slate-600">{hint ?? '↕ drag'}</span>
      </div>
      <div className="flex items-center justify-between">
        <EdgeArrow
          direction="left"
          onTap={onLeftEdgeTap}
          enabled={canDecrement && !disabled}
        />
        <span className="text-xl font-semibold tabular-nums text-slate-100">
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
          'px-2 text-base leading-none',
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
        'rounded-md px-2 py-1 text-base leading-none transition active:scale-90',
        enabled
          ? 'text-slate-300 hover:text-emerald-300 active:text-emerald-300'
          : 'text-slate-700',
      ].join(' ')}
    >
      {glyph}
    </button>
  );
}
