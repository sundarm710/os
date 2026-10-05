// Task Triage: paste a raw task dump, the agent proposes project + date per
// line, Sundar reviews one card at a time, then everything is filed in one
// add_batch call. Nothing reaches the vault before commitTriage().

import { postJson } from './webhookClient';
import { clearKey, readString, writeString } from './storage';

const TRIAGE_URL = import.meta.env.VITE_WEBHOOK_TASK_TRIAGE_URL;
const TASKS_URL = import.meta.env.VITE_WEBHOOK_TASKS_URL;

// The agent call is a Claude Sonnet run over the whole list — ~30–60s.
const PROPOSE_TIMEOUT_MS = 120_000;

export type TriageProposal = {
  n: number;
  original: string;
  text: string;
  project: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  confidence: 'high' | 'low';
  question: string | null;
};

export type TriageDecision = 'pending' | 'accepted' | 'dropped';

export type TriageCard = TriageProposal & { decision: TriageDecision };

export type TriageDraft = {
  cards: TriageCard[];
  index: number;
};

export type TriageCommitResult = {
  added: number;
  skipped: number;
  errors: string[];
};

export async function proposeTriage(raw: string): Promise<TriageProposal[]> {
  const res = await postJson(TRIAGE_URL, { raw }, { timeoutMs: PROPOSE_TIMEOUT_MS });
  const data = (await res.json()) as
    | { ok: true; items: TriageProposal[] }
    | { ok: false; error: string };
  if (!data.ok) throw new Error(data.error);
  return data.items;
}

/**
 * Low-confidence cards first so the questions get answered while attention
 * is fresh; original list order otherwise.
 */
export function toReviewCards(items: TriageProposal[]): TriageCard[] {
  const cards = items.map((it) => ({ ...it, decision: 'pending' as const }));
  const low = cards.filter((c) => c.confidence === 'low');
  const high = cards.filter((c) => c.confidence !== 'low');
  return [...low, ...high];
}

/** Next card still pending after `from`, wrapping once; -1 when all decided. */
export function nextPendingIndex(cards: TriageCard[], from: number): number {
  for (let step = 1; step <= cards.length; step++) {
    const i = (from + step) % cards.length;
    if (cards[i].decision === 'pending') return i;
  }
  return -1;
}

export function summarize(cards: TriageCard[]) {
  const accepted = cards.filter((c) => c.decision === 'accepted');
  return {
    file: accepted.filter((c) => !c.done).length,
    logDone: accepted.filter((c) => c.done).length,
    dropped: cards.filter((c) => c.decision === 'dropped').length,
    pending: cards.filter((c) => c.decision === 'pending').length,
  };
}

export function buildCommitItems(cards: TriageCard[]) {
  return cards
    .filter((c) => c.decision === 'accepted' && c.text.trim())
    .map((c) => ({
      text: c.text.trim(),
      project: c.project,
      due: c.due,
      ...(c.done ? { done: true } : {}),
    }));
}

export async function commitTriage(cards: TriageCard[]): Promise<TriageCommitResult> {
  const items = buildCommitItems(cards);
  if (items.length === 0) return { added: 0, skipped: 0, errors: [] };
  const res = await postJson(TASKS_URL, { action: 'add_batch', items }, { timeoutMs: 45_000 });
  const data = (await res.json()) as {
    ok: boolean;
    added?: unknown[];
    skipped?: unknown[];
    errors?: { text?: string; error?: string }[];
  };
  return {
    added: data.added?.length ?? 0,
    skipped: data.skipped?.length ?? 0,
    errors: (data.errors ?? []).map((e) => [e.text, e.error].filter(Boolean).join(': ')),
  };
}

export function loadTriageDraft(): TriageDraft | null {
  const raw = readString('triageDraft');
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as TriageDraft;
    return Array.isArray(draft.cards) && draft.cards.length ? draft : null;
  } catch {
    return null;
  }
}

export function saveTriageDraft(draft: TriageDraft): void {
  writeString('triageDraft', JSON.stringify(draft));
}

export function clearTriageDraft(): void {
  clearKey('triageDraft');
}
