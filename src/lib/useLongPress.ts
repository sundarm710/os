import { useRef } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

const DEFAULT_MS = 500;

export type LongPressHandlers = {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onClick: (e: ReactMouseEvent) => void;
};

/**
 * Distinguish a short tap from a long press on the same element. Spread the
 * returned handlers onto any element (button, div, li).
 *
 * Long-press fires after `ms` of continuous press; the trailing click is
 * swallowed so a short-press callback can sit safely on the same element.
 * onContextMenu is suppressed because mobile Safari otherwise pops the OS
 * text-selection menu after ~500ms of touch.
 *
 * Pass only the callbacks you need — both are optional.
 */
export function useLongPress({
  onShortPress,
  onLongPress,
  ms = DEFAULT_MS,
}: {
  onShortPress?: () => void;
  onLongPress?: () => void;
  ms?: number;
}): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: () => {
      if (!onLongPress) return;
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      clear();
      onShortPress?.();
    },
  };
}
