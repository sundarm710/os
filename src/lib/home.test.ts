import { describe, expect, it } from 'vitest';
import {
  buildPhotoBatch,
  decidePhotoCard,
  nextPendingPhotoIndex,
  summarizePhoto,
  toPhotoCards,
  type ProposedItem,
} from './home';

const item = (n: number, name: string, extra: Partial<ProposedItem> = {}): ProposedItem => ({
  n,
  name,
  kind: 'item',
  category: 'non_perishable',
  qty: null,
  unit: null,
  expires_on: null,
  replace_every_days: null,
  aliases: [],
  attrs: {},
  confidence: 'high',
  question: null,
  children: [],
  ...extra,
});

// Spice box (1) holding Jeera (2) and Mustard (3); then Sponge (4).
const PROPOSAL: ProposedItem[] = [
  item(1, 'Spice box', { kind: 'container', category: 'container', children: [item(2, 'Jeera', { aliases: ['cumin'] }), item(3, 'Mustard')] }),
  item(4, 'Sponge', { category: 'cleaning', replace_every_days: 14 }),
];

describe('toPhotoCards', () => {
  it('flattens depth-first and remembers the container', () => {
    const cards = toPhotoCards(PROPOSAL);
    expect(cards.map((c) => [c.name, c.parentN, c.inside])).toEqual([
      ['Spice box', null, null],
      ['Jeera', 1, 'Spice box'],
      ['Mustard', 1, 'Spice box'],
      ['Sponge', null, null],
    ]);
    expect(cards.every((c) => c.decision === 'pending')).toBe(true);
  });
});

describe('decidePhotoCard', () => {
  it('dropping a container drops what is inside it', () => {
    const cards = decidePhotoCard(toPhotoCards(PROPOSAL), 0, 'dropped');
    expect(cards.map((c) => c.decision)).toEqual(['dropped', 'dropped', 'dropped', 'pending']);
  });

  it('accepting a container leaves its contents to review', () => {
    const cards = decidePhotoCard(toPhotoCards(PROPOSAL), 0, 'accepted');
    expect(cards.map((c) => c.decision)).toEqual(['accepted', 'pending', 'pending', 'pending']);
  });
});

describe('nextPendingPhotoIndex / summarizePhoto', () => {
  it('wraps to skipped cards and counts decisions', () => {
    let cards = toPhotoCards(PROPOSAL);
    cards = decidePhotoCard(cards, 1, 'accepted');
    cards = decidePhotoCard(cards, 3, 'dropped');
    expect(nextPendingPhotoIndex(cards, 3)).toBe(0);
    expect(summarizePhoto(cards)).toEqual({ save: 1, dropped: 1, pending: 2 });
  });
});

describe('buildPhotoBatch', () => {
  it('rebuilds nesting from accepted cards with only set fields', () => {
    let cards = toPhotoCards(PROPOSAL);
    for (const i of [0, 1, 3]) cards = decidePhotoCard(cards, i, 'accepted');
    cards = decidePhotoCard(cards, 2, 'dropped');
    expect(buildPhotoBatch(cards)).toEqual([
      {
        name: 'Spice box',
        kind: 'container',
        category: 'container',
        children: [{ name: 'Jeera', kind: 'item', category: 'non_perishable', aliases: ['cumin'] }],
      },
      { name: 'Sponge', kind: 'item', category: 'cleaning', replace_every_days: 14 },
    ]);
  });

  it('lifts contents of a skipped container into the place', () => {
    let cards = toPhotoCards(PROPOSAL);
    cards = decidePhotoCard(cards, 1, 'accepted');
    expect(buildPhotoBatch(cards).map((i) => i.name)).toEqual(['Jeera']);
  });

  it('uses renamed text and ignores blank names', () => {
    let cards = toPhotoCards([item(1, 'Red-lid dabba', { confidence: 'low', question: "What's inside?" }), item(2, 'X')]);
    cards = cards.map((c, i) => (i === 0 ? { ...c, name: '  Toor dal ' } : { ...c, name: ' ' }));
    cards = decidePhotoCard(cards, 0, 'accepted');
    cards = decidePhotoCard(cards, 1, 'accepted');
    expect(buildPhotoBatch(cards)).toEqual([{ name: 'Toor dal', kind: 'item', category: 'non_perishable' }]);
  });
});
