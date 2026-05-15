/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBHOOK_JOURNAL_URL: string;
  readonly VITE_WEBHOOK_CALENDAR_URL: string;
  readonly VITE_WEBHOOK_CALENDAR_FETCH_URL: string;
  readonly VITE_WEBHOOK_TASKS_URL: string;
  readonly VITE_WEBHOOK_WORKOUTS_FETCH_URL: string;
  readonly VITE_AUTH_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
