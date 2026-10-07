import { describe, expect, it } from 'vitest';
import {
  buildPhotoBatch,
  childKind,
  moveTargets,
  moveTargetsFor,
  stockLevel,
  addPhotoCard,
  daysUntil,
  expiryLabel,
  matchesFilter,
  nodePaths,
  placesFromNodes,
  childrenByParent,
  type HomeNode,
  decidePhotoCard,
  nextPendingPhotoIndex,
  summarizePhoto,
  toPhotoCards,
  type Place,
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

const place = (id: string, path: string, kind: Place['kind']): Place => ({ id, path, kind, items: 0 });
const PLACES: Place[] = [
  place('k', 'Kitchen', 'space'),
  place('u', 'Kitchen › Upper cupboard', 'zone'),
  place('ul', 'Kitchen › Upper cupboard › Left', 'slot'),
  place('ul1', 'Kitchen › Upper cupboard › Left › Shelf 1', 'slot'),
  place('box', 'Kitchen › Upper cupboard › Left › Shelf 1 › Spice box', 'container'),
  place('lo', 'Kitchen › Loft', 'zone'),
  place('uleft2', 'Kitchen › Upper cupboard › Leftovers', 'slot'),
];

describe('childKind', () => {
  it('rooms hold zones, containers hold containers, everything else holds slots', () => {
    expect(childKind(PLACES[0])).toBe('zone');
    expect(childKind(PLACES[2])).toBe('slot');
    expect(childKind(PLACES[4])).toBe('container');
  });
});

describe('moveTargets', () => {
  it('excludes itself, its descendants and its current parent', () => {
    expect(moveTargets(PLACES, PLACES[2]).map((p) => p.id)).toEqual(['k', 'lo', 'uleft2']);
  });

  it('does not treat a sibling with a longer name as a descendant', () => {
    expect(moveTargets(PLACES, PLACES[2]).map((p) => p.id)).toContain('uleft2');
  });
});

describe('kitchen tree helpers', () => {
  const N = (id: string, name: string, kind: HomeNode['kind'], parent_id?: string): HomeNode => ({
    id, name, kind, parent_id, status: 'ok',
  });
  const NODES = [
    N('k', 'Kitchen', 'space'),
    N('l', 'Left', 'zone', 'k'),
    N('c1', 'Cupboard 1', 'slot', 'l'),
    N('c2', 'Cupboard 2', 'slot', 'l'),
    N('rice', 'Rice', 'item', 'c1'),
    N('dal', 'Dal', 'item', 'c1'),
  ];

  it('groups direct children by parent', () => {
    expect(childrenByParent(NODES).get('c1')?.map((n) => n.name)).toEqual(['Rice', 'Dal']);
    expect(childrenByParent(NODES).get('')?.map((n) => n.id)).toEqual(['k']);
  });

  it('derives places with breadcrumb paths and item counts, without items', () => {
    const places = placesFromNodes(NODES);
    expect(places.map((p) => p.path)).toContain('Kitchen › Left › Cupboard 1');
    expect(places.find((p) => p.id === 'c1')?.items).toBe(2);
    expect(places.some((p) => p.id === 'rice')).toBe(false);
  });

  it('lets an item move to any spot except its current one and the room itself', () => {
    expect(moveTargetsFor(NODES, NODES[4]).map((p) => p.id).sort()).toEqual(['c2', 'l']);
  });
});

describe('stockLevel', () => {
  const base: HomeNode = { id: 'x', name: 'Milk', kind: 'item', category: 'perishable', status: 'ok' };
  it('applies to any item but not to containers or places', () => {
    expect(stockLevel({ ...base, category: 'non_perishable' })).toBe('good');
    expect(stockLevel({ ...base, kind: 'container' })).toBeNull();
    expect(stockLevel({ ...base, kind: 'slot' })).toBeNull();
  });
  it('reads full / good from the stored level, defaulting to good', () => {
    expect(stockLevel({ ...base, level: 'full' })).toBe('full');
    expect(stockLevel(base)).toBe('good');
  });
  it('lets low and out status win over the stored level', () => {
    expect(stockLevel({ ...base, level: 'full', status: 'low' })).toBe('low');
    expect(stockLevel({ ...base, level: 'full', status: 'out' })).toBe('empty');
  });
});

describe('expiry + filters', () => {
  const today = '2026-10-07';
  const item = (extra: Partial<HomeNode>): HomeNode => ({ id: 'i', name: 'Milk', kind: 'item', status: 'ok', ...extra });

  it('counts days across month ends', () => {
    expect(daysUntil('2026-10-12', today)).toBe(5);
    expect(daysUntil('2026-11-01', today)).toBe(25);
    expect(daysUntil('2026-10-05', today)).toBe(-2);
  });

  it('labels expired, imminent and far dates', () => {
    expect(expiryLabel('2026-10-05', today)).toEqual({ text: 'expired 2d ago', tone: 'bad' });
    expect(expiryLabel('2026-10-07', today).tone).toBe('bad');
    expect(expiryLabel('2026-10-10', today)).toEqual({ text: 'expires in 3d', tone: 'soon' });
    expect(expiryLabel('2026-12-25', today)).toEqual({ text: 'exp 25/12/26', tone: 'ok' });
  });

  it('filters empty, low and nearing expiry; only items qualify', () => {
    expect(matchesFilter(item({ status: 'out' }), 'empty', today)).toBe(true);
    expect(matchesFilter(item({ status: 'low' }), 'low', today)).toBe(true);
    expect(matchesFilter(item({ status: 'low' }), 'empty', today)).toBe(false);
    expect(matchesFilter(item({ expires_on: '2026-10-14' }), 'expiring', today)).toBe(true);
    expect(matchesFilter(item({ expires_on: '2026-10-15' }), 'expiring', today)).toBe(false);
    expect(matchesFilter({ ...item({ status: 'out' }), kind: 'container' }, 'empty', today)).toBe(false);
  });

  it('builds paths without the room name', () => {
    const n = (id: string, name: string, parent_id?: string): HomeNode => ({ id, name, kind: 'slot', status: 'ok', parent_id });
    const paths = nodePaths([n('k', 'Kitchen'), n('l', 'Left', 'k'), n('c', 'Cupboard 1', 'l')]);
    expect(paths.get('c')).toBe('Left › Cupboard 1');
    expect(paths.get('k')).toBe('');
  });
});

describe('addPhotoCard', () => {
  const start = toPhotoCards([{ ...item(1, 'Spice box'), kind: 'container', children: [item(2, 'Cumin')] }]);

  it('nests a hand-added thing inside a container card and accepts that container', () => {
    const { cards, index } = addPhotoCard(start, 0, start[0], 'Turmeric', 'non_perishable');
    expect(index).toBe(1);
    expect(cards[1]).toMatchObject({ name: 'Turmeric', parentN: 1, inside: 'Spice box', decision: 'accepted', category: 'non_perishable' });
    expect(cards[0].decision).toBe('accepted');
    expect(cards.map((c) => c.n)).toEqual([1, 3, 2]);
  });

  it('adds a new container that later things can go into, and commits the nesting', () => {
    const a = addPhotoCard(start, 1, null, 'Steel box', 'container');
    expect(a.cards[2]).toMatchObject({ kind: 'container', parentN: null });
    const b = addPhotoCard(a.cards, a.index, a.cards[a.index], 'Lid', 'other');
    const batch = buildPhotoBatch(b.cards.map((c) => ({ ...c, decision: 'accepted' as const })));
    const box = batch.find((x) => x.name === 'Steel box');
    expect(box?.children?.map((x) => x.name)).toEqual(['Lid']);
  });

  it('gives new perishables a full stock level', () => {
    expect(addPhotoCard(start, 0, null, 'Milk', 'perishable').cards[1].attrs).toEqual({ level: 'full' });
  });
});
