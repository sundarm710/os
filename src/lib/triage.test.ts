import { describe, expect, it } from 'vitest';
import {
  buildCommitItems,
  nextPendingIndex,
  summarize,
  toReviewCards,
  type TriageProposal,
} from './triage';

const base = { due: '2026-10-05', done: false, question: null } as const;
const ITEMS: TriageProposal[] = [
  { ...base, n: 1, original: 'Meal plan update', text: 'Update meal plan', project: 'Home & Life', confidence: 'high' },
  { ...base, n: 2, original: 'Porter follow up', text: 'Follow up with Porter', project: 'Home & Life', confidence: 'low', question: 'App or person?' },
  { ...base, n: 3, original: 'Recliner moving done', text: 'Move recliner', project: 'Home & Life', confidence: 'high', done: true },
  { ...base, n: 4, original: 'Amrutha to send dishrack options', text: 'Send dishrack options', project: 'Amrutha', confidence: 'high' },
];

describe('toReviewCards', () => {
  it('puts low-confidence cards first, keeping list order otherwise', () => {
    expect(toReviewCards(ITEMS).map((c) => c.n)).toEqual([2, 1, 3, 4]);
  });

  it('starts every card pending', () => {
    expect(toReviewCards(ITEMS).every((c) => c.decision === 'pending')).toBe(true);
  });
});

describe('nextPendingIndex', () => {
  it('wraps around to skipped cards and returns -1 when all decided', () => {
    const cards = toReviewCards(ITEMS);
    cards[1].decision = 'accepted';
    cards[2].decision = 'accepted';
    cards[3].decision = 'dropped';
    expect(nextPendingIndex(cards, 3)).toBe(0);
    cards[0].decision = 'accepted';
    expect(nextPendingIndex(cards, 0)).toBe(-1);
  });
});

describe('commit payload', () => {
  it('sends only accepted cards, flags done ones, and trims edited text', () => {
    const cards = toReviewCards(ITEMS);
    cards[0].decision = 'dropped'; // Porter
    cards[1].decision = 'accepted';
    cards[1].text = '  Update meal plan for the week ';
    cards[2].decision = 'accepted'; // recliner, done
    // cards[3] left pending → not sent
    expect(buildCommitItems(cards)).toEqual([
      { text: 'Update meal plan for the week', project: 'Home & Life', due: '2026-10-05' },
      { text: 'Move recliner', project: 'Home & Life', due: '2026-10-05', done: true },
    ]);
    expect(summarize(cards)).toEqual({ file: 1, logDone: 1, dropped: 1, pending: 1 });
  });
});
