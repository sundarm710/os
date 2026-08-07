// Deliberately NOT referencing vite/client: its ImportMetaEnv carries an
// index signature that turns env-var typos into runtime `undefined` URLs.
// Declaring the interface closed makes an unknown key a compile error.
declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_WEBHOOK_JOURNAL_URL: string;
  readonly VITE_WEBHOOK_JOURNAL_FETCH_URL: string;
  readonly VITE_WEBHOOK_CALENDAR_URL: string;
  readonly VITE_WEBHOOK_CALENDAR_FETCH_URL: string;
  readonly VITE_WEBHOOK_TASKS_URL: string;
  readonly VITE_WEBHOOK_WORKOUTS_FETCH_URL: string;
  readonly VITE_WEBHOOK_DAILY_NOTE_URL: string;
  readonly VITE_WEBHOOK_PEOPLE_URL: string;
  readonly VITE_WEBHOOK_NOTES_URL: string;
  readonly VITE_WEBHOOK_LEARN_TOPICS_URL: string;
  readonly VITE_WEBHOOK_LEARN_TOPIC_URL: string;
  readonly VITE_WEBHOOK_LEARN_STATE_URL: string;
  readonly VITE_WEBHOOK_LEARN_TRANSCRIPT_URL: string;
  readonly VITE_WEBHOOK_LEARN_RESOURCES_URL: string;
  readonly VITE_WEBHOOK_LEARN_ANSWER_URL: string;
  readonly VITE_WEBHOOK_CHAT_URL: string;
  /** Dev/test fallback only — production auth is the runtime token (lib/auth.ts). */
  readonly VITE_AUTH_TOKEN?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
