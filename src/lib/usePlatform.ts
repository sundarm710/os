import { useEffect, useState } from 'react';

// True on devices with a precise pointer AND hover — i.e. a mouse/trackpad
// desktop or laptop, where physical-keyboard shortcuts make sense. Touch
// phones/tablets report `(pointer: coarse)` / `(hover: none)` and get false,
// so the keyboard/omnibar layer stays hidden and the tap UI is untouched.
const QUERY = '(hover: hover) and (pointer: fine)';

export function useIsKeyboardDevice(): boolean {
  const [isKeyboard, setIsKeyboard] = useState<boolean>(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsKeyboard(e.matches);
    mql.addEventListener('change', onChange);
    setIsKeyboard(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isKeyboard;
}
