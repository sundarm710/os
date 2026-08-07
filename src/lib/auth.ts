// Client-side auth token store. The token is entered once via LoginGate and
// kept in localStorage — it is NOT baked into the build. This is the whole
// point of the in-app login: an unauthenticated visitor who loads the public
// PWA shell gets no usable X-Auth-Token, so the n8n webhooks stay gated even
// though the static frontend is reachable without Basic Auth.
//
// The old model baked VITE_AUTH_TOKEN into the JS bundle, which meant the
// token was extractable by anyone who could load the app — so the Traefik
// Basic Auth wall was the only real gate, and that wall is incompatible with
// an installed PWA (standalone PWAs can't show the Basic Auth dialog).

import { readString, writeString, clearKey } from './storage';

// Fired when a webhook rejects our token (401/403). LoginGate listens and
// bounces the user back to the unlock screen with an error.
const AUTH_INVALID_EVENT = 'auth:invalid';

export function getAuthToken(): string {
  const stored = readString('authToken');
  if (stored) return stored;
  // Dev/test fallback only. In production builds VITE_AUTH_TOKEN is unset, so
  // this yields '' and LoginGate takes over. Tests stub it via vi.stubEnv.
  return import.meta.env.VITE_AUTH_TOKEN ?? '';
}

export function setAuthToken(token: string): void {
  writeString('authToken', token);
}

export function clearAuthToken(): void {
  clearKey('authToken');
}

export function notifyAuthInvalid(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
}

export function onAuthInvalid(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_INVALID_EVENT, handler);
  return () => window.removeEventListener(AUTH_INVALID_EVENT, handler);
}
