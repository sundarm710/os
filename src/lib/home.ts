// Home inventory (Kitchen tab). Photo onboarding: pick a place, snap a photo,
// the agent proposes what's in it (with nesting), Sundar reviews one card at a
// time, then everything is saved in one add_batch call. Nothing reaches the
// inventory before commitPhoto().

import { postJson, WebhookError } from './webhookClient';
import { clearKey, readString, writeString } from './storage';

const HOME_URL = import.meta.env.VITE_WEBHOOK_HOME_URL;
const HOME_PHOTO_URL = import.meta.env.VITE_WEBHOOK_HOME_PHOTO_URL;

// Claude Sonnet reading a photo — ~20–40s.
const PROPOSE_TIMEOUT_MS = 120_000;
// Phone photos are 3–5 MB; the agent reads labels fine at this size.
const MAX_PHOTO_EDGE = 1600;

export const CATEGORIES = [
  'perishable',
  'non_perishable',
  'appliance',
  'cleaning',
  'utensil',
  'container',
  'bag',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Place = {
  id: string;
  path: string; // "Kitchen › Upper cupboard › Left"
  kind: 'space' | 'zone' | 'slot' | 'container';
  items: number;
};

export type ProposedItem = {
  n: number;
  name: string;
  kind: 'item' | 'container';
  category: Category;
  qty: number | null;
  unit: string | null;
  expires_on: string | null; // YYYY-MM-DD
  replace_every_days: number | null;
  aliases: string[];
  attrs: Record<string, unknown>;
  confidence: 'high' | 'low';
  question: string | null;
  children: ProposedItem[];
};

export type PhotoProposal = {
  parent: string;
  place: string;
  photo_path: string;
  notes: string | null;
  items: ProposedItem[];
};

export type PhotoDecision = 'pending' | 'accepted' | 'dropped';

/** One card per proposed thing; nesting kept via parentN (null = directly in the place). */
export type PhotoCard = Omit<ProposedItem, 'children'> & {
  parentN: number | null;
  inside: string | null; // parent's name, for "inside Spice box"
  decision: PhotoDecision;
};

export type PhotoDraft = {
  parent: string;
  place: string;
  photo_path: string;
  notes: string | null;
  cards: PhotoCard[];
  index: number;
};

export type PhotoCommitResult = { added: number; skipped: number; errors: string[] };

export async function fetchPlaces(): Promise<Place[]> {
  const res = await postJson(HOME_URL, { action: 'places' });
  const data = (await res.json()) as { ok: boolean; places?: Place[]; error?: string };
  if (!data.ok || !data.places) throw new Error(data.error || 'Could not load places');
  return data.places;
}

/** Any live thing in the home: a place, a container, or an item. */
export type HomeNode = {
  id: string;
  parent_id?: string;
  name: string;
  kind: Place['kind'] | 'item';
  category?: Category;
  level?: string;
  qty?: number;
  unit?: string;
  status: string;
};

export async function fetchNodes(): Promise<HomeNode[]> {
  const res = await postJson(HOME_URL, { action: 'nodes' });
  const data = (await res.json()) as { ok: boolean; nodes?: HomeNode[]; error?: string };
  if (!data.ok || !data.nodes) throw new Error(data.error || 'Could not load the kitchen');
  return data.nodes;
}

/** parent id (or '' for roots) → its direct children, in name order. */
export function childrenByParent(nodes: HomeNode[]): Map<string, HomeNode[]> {
  const out = new Map<string, HomeNode[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? '';
    const list = out.get(key);
    if (list) list.push(n);
    else out.set(key, [n]);
  }
  return out;
}

/** Places and containers (no items) with breadcrumb paths, in the shape the photo flow and layout screen use. */
export function placesFromNodes(nodes: HomeNode[]): Place[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = childrenByParent(nodes);
  const pathOf = (n: HomeNode): string => {
    const parts: string[] = [];
    for (let cur: HomeNode | undefined = n; cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
      parts.push(cur.name);
    }
    return parts.reverse().join(' › ');
  };
  return nodes
    .filter((n): n is HomeNode & { kind: Place['kind'] } => n.kind !== 'item')
    .map((n) => ({
      id: n.id,
      path: pathOf(n),
      kind: n.kind,
      items: (kids.get(n.id) ?? []).filter((c) => c.kind === 'item').length,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Where a thing may be moved: any place or container except itself, what is inside it, or where it already is. */
export function moveTargetsFor(nodes: HomeNode[], node: HomeNode): Place[] {
  const places = placesFromNodes(nodes);
  const own = places.find((p) => p.id === node.id);
  if (own) return moveTargets(places, own);
  // Items: any spot below the room itself, except the one they are already in.
  return places.filter((p) => p.kind !== 'space' && p.id !== node.parent_id);
}

// ── Layout (Kitchen settings): add / rename / move / delete places ──────────

function errorFrom(body: string): string | null {
  try {
    return (JSON.parse(body) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}

async function homeAction(payload: Record<string, unknown>): Promise<void> {
  let res: Response;
  try {
    res = await postJson(HOME_URL, payload);
  } catch (e) {
    // 400s carry a useful message ("still holds 3 thing(s)…") in the body.
    if (e instanceof WebhookError) throw new Error(errorFrom(e.body) ?? e.message);
    throw e;
  }
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error || 'Something went wrong');
}

/** The kind a new place gets from where it is added: rooms hold zones, containers hold containers. */
export function childKind(parent: Place): Place['kind'] {
  if (parent.kind === 'space') return 'zone';
  if (parent.kind === 'container') return 'container';
  return 'slot';
}

export const addPlace = (parent: Place, name: string) =>
  homeAction({ action: 'add_place', parent: parent.id, name, kind: childKind(parent) });
export const renamePlace = (id: string, name: string) => homeAction({ action: 'rename', ref: id, name });
export const movePlace = (id: string, to: string) => homeAction({ action: 'move', ref: id, to });
// ── Stock level (perishables) ───────────────────────────────────────────────

export const LEVELS = ['full', 'good', 'low', 'empty'] as const;
export type Level = (typeof LEVELS)[number];

/** Level shown for a perishable thing; null for everything else. low/out in the DB win over the stored level. */
export function stockLevel(n: HomeNode): Level | null {
  if (n.kind !== 'item' || n.category !== 'perishable') return null;
  if (n.status === 'out') return 'empty';
  if (n.status === 'low') return 'low';
  return n.level === 'full' ? 'full' : 'good';
}

// Soft, desaturated tones that sit on the dark UI: green = plenty, blue = fine, amber = running out, rose = gone.
export const LEVEL_STYLE: Record<Level, { label: string; dot: string; chip: string }> = {
  full: { label: 'Full', dot: 'bg-emerald-400', chip: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' },
  good: { label: 'Good for now', dot: 'bg-sky-400', chip: 'border-sky-500/40 bg-sky-500/15 text-sky-200' },
  low: { label: 'Running low', dot: 'bg-amber-400', chip: 'border-amber-500/40 bg-amber-500/15 text-amber-200' },
  empty: { label: 'Empty', dot: 'bg-rose-400', chip: 'border-rose-500/40 bg-rose-500/15 text-rose-200' },
};

/** What a thing can be: a container (holds things) or one of the item categories. */
export const TYPE_OPTIONS: { value: Category; label: string }[] = [
  { value: 'container', label: '📦 Container' },
  { value: 'perishable', label: '🥛 Perishable' },
  { value: 'non_perishable', label: '🥫 Non-perishable' },
  { value: 'cleaning', label: '🧽 Cleaning' },
  { value: 'utensil', label: '🍴 Utensil' },
  { value: 'appliance', label: '🔌 Appliance' },
  { value: 'bag', label: '🛍 Bag' },
  { value: 'other', label: 'Other' },
];

export const setLevel = (id: string, level: Level) => homeAction({ action: 'set_level', ref: id, level });
export const setType = (id: string, type: Category) => homeAction({ action: 'set_type', ref: id, type });
/** Quick-add a thing inside a container (perishables start Full). */
export const addItem = (parent: string, name: string, category: Category = 'perishable') =>
  homeAction({ action: 'add_item', parent, name, category });

export const addAlias = (id: string, alias: string) => homeAction({ action: 'alias', ref: id, alias });
export const deletePlace = (id: string) => homeAction({ action: 'delete', ref: id });

/** Places `p` may move into: not itself, not anything inside it, not where it already is. */
export function moveTargets(places: Place[], p: Place): Place[] {
  const parentPath = p.path.split(' › ').slice(0, -1).join(' › ');
  return places.filter(
    (t) => t.id !== p.id && !t.path.startsWith(p.path + ' › ') && t.path !== parentPath,
  );
}

export async function proposePhoto(image: string, parent: string, note: string): Promise<PhotoProposal> {
  const res = await postJson(
    HOME_PHOTO_URL,
    { image, parent, note: note.trim() || undefined },
    { timeoutMs: PROPOSE_TIMEOUT_MS },
  );
  const data = (await res.json()) as ({ ok: true } & PhotoProposal) | { ok: false; error: string };
  if (!data.ok) throw new Error(data.error);
  return data;
}

/**
 * Depth-first, so a container's card comes right before its contents. Unlike
 * Task Triage, questions are not pulled to the front — reviewing a jar before
 * the box it sits in would be confusing.
 */
export function toPhotoCards(items: ProposedItem[]): PhotoCard[] {
  const out: PhotoCard[] = [];
  const walk = (list: ProposedItem[], parent: ProposedItem | null) => {
    for (const it of list) {
      const { children, ...rest } = it;
      out.push({ ...rest, parentN: parent?.n ?? null, inside: parent?.name ?? null, decision: 'pending' });
      walk(children, it);
    }
  };
  walk(items, null);
  return out;
}

/** Dropping a container drops everything inside it. */
export function decidePhotoCard(cards: PhotoCard[], index: number, decision: PhotoDecision): PhotoCard[] {
  const next = cards.map((c, i) => (i === index ? { ...c, decision } : c));
  if (decision !== 'dropped') return next;
  const dropped = new Set([next[index].n]);
  return next.map((c) => {
    if (c.parentN !== null && dropped.has(c.parentN)) {
      dropped.add(c.n);
      return { ...c, decision: 'dropped' as const };
    }
    return c;
  });
}

/** Next card still pending after `from`, wrapping once; -1 when all decided. */
export function nextPendingPhotoIndex(cards: PhotoCard[], from: number): number {
  for (let step = 1; step <= cards.length; step++) {
    const i = (from + step) % cards.length;
    if (cards[i].decision === 'pending') return i;
  }
  return -1;
}

export function summarizePhoto(cards: PhotoCard[]) {
  return {
    save: cards.filter((c) => c.decision === 'accepted').length,
    dropped: cards.filter((c) => c.decision === 'dropped').length,
    pending: cards.filter((c) => c.decision === 'pending').length,
  };
}

type BatchItem = {
  name: string;
  kind: 'item' | 'container';
  category: Category;
  qty?: number;
  unit?: string;
  expires_on?: string;
  replace_every_days?: number;
  aliases?: string[];
  attrs?: Record<string, unknown>;
  children?: BatchItem[];
};

/**
 * Rebuild the nested add_batch payload from accepted cards. A card whose
 * container was skipped (not accepted) moves up to the nearest accepted
 * ancestor — or straight into the place — so nothing accepted is lost.
 */
export function buildPhotoBatch(cards: PhotoCard[]): BatchItem[] {
  const byN = new Map(cards.map((c) => [c.n, c]));
  const accepted = cards.filter((c) => c.decision === 'accepted' && c.name.trim());
  const home = (c: PhotoCard): number | null => {
    let p = c.parentN;
    while (p !== null && byN.get(p)?.decision !== 'accepted') p = byN.get(p)?.parentN ?? null;
    return p;
  };
  const build = (parentN: number | null): BatchItem[] =>
    accepted
      .filter((c) => home(c) === parentN)
      .map((c) => {
        const children = build(c.n);
        const item: BatchItem = { name: c.name.trim(), kind: children.length ? 'container' : c.kind, category: c.category };
        if (c.qty !== null) item.qty = c.qty;
        if (c.qty !== null && c.unit) item.unit = c.unit;
        if (c.expires_on) item.expires_on = c.expires_on;
        if (c.replace_every_days) item.replace_every_days = c.replace_every_days;
        if (c.aliases.length) item.aliases = c.aliases;
        if (Object.keys(c.attrs).length) item.attrs = c.attrs;
        if (children.length) item.children = children;
        return item;
      });
  return build(null);
}

export async function commitPhoto(draft: PhotoDraft): Promise<PhotoCommitResult> {
  const items = buildPhotoBatch(draft.cards);
  if (items.length === 0) return { added: 0, skipped: 0, errors: [] };
  const res = await postJson(
    HOME_URL,
    { action: 'add_batch', parent: draft.parent, photo_path: draft.photo_path, items },
    { timeoutMs: 45_000 },
  );
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    added?: string[];
    skipped?: string[];
    errors?: { path?: string; error?: string }[];
  };
  if (!data.ok) throw new Error(data.error || 'Save failed');
  return {
    added: data.added?.length ?? 0,
    skipped: data.skipped?.length ?? 0,
    errors: (data.errors ?? []).map((e) => [e.path, e.error].filter(Boolean).join(': ')),
  };
}

/** Resize to MAX_PHOTO_EDGE and re-encode as JPEG; returns base64 without the data: prefix. */
export async function photoToBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not open that photo'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that photo');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadPhotoDraft(): PhotoDraft | null {
  const raw = readString('homePhotoDraft');
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as PhotoDraft;
    return Array.isArray(draft.cards) && draft.cards.length ? draft : null;
  } catch {
    return null;
  }
}

export function savePhotoDraft(draft: PhotoDraft): void {
  writeString('homePhotoDraft', JSON.stringify(draft));
}

export function clearPhotoDraft(): void {
  clearKey('homePhotoDraft');
}
