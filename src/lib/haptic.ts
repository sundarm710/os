// Centralised haptic patterns. Durations are tuned for Android vibration
// motors (which need ≥30ms to be perceptible) — do not lower without
// testing on real Android hardware.

export const HapticPattern = {
  tap: 30,
  submitStart: 40,
  successRamp: [60, 80, 120],
  warning: [40, 60, 40],
} as const satisfies Record<string, number | readonly number[]>;

export type HapticName = keyof typeof HapticPattern;

export function haptic(name: HapticName): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  // navigator.vibrate accepts number | number[] per spec; lib type is narrow.
  const pattern = HapticPattern[name];
  (navigator.vibrate as (p: number | readonly number[]) => boolean)(pattern);
}
