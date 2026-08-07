import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getAuthToken, setAuthToken, onAuthInvalid } from '../lib/auth';

// Gates the app behind a token the user enters once. The token is stored in
// localStorage (see lib/auth.ts) and sent as X-Auth-Token on every webhook.
// If a webhook later rejects the token (401/403), webhookClient clears it and
// fires auth:invalid, which bounces us back to this screen with an error.
export function LoginGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => getAuthToken());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return onAuthInvalid(() => {
      setToken('');
      setError('That token was rejected — enter it again.');
    });
  }, []);

  if (token) return <>{children}</>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t) {
      setError('Enter your access token.');
      return;
    }
    setAuthToken(t);
    setToken(t);
    setInput('');
    setError('');
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-8">
      <h1 className="text-2xl font-semibold text-slate-100">Sundar OS</h1>
      <p className="mt-2 text-sm text-slate-400">
        Enter your access token to unlock the app.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Access token"
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-slate-500"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-4 py-3 font-medium text-slate-900 active:scale-[0.99]"
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
