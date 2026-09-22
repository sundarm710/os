import { useEffect, useState } from 'react';
import { type ChecklistAudience, type ChecklistItemType, type PartnerChecklistItem } from '../lib/api';
import { haptic } from '../lib/haptic';

interface Props {
  open: boolean;
  items: PartnerChecklistItem[] | null;
  onClose: () => void;
  onAdd: (label: string, type: ChecklistItemType, audience: ChecklistAudience) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

export function ManagePartnerItemsSheet({ open, items, onClose, onAdd, onDeactivate, onReorder }: Props) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ChecklistItemType>('boolean');
  const [audience, setAudience] = useState<ChecklistAudience>('self');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel('');
      setType('boolean');
      setAudience('self');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const sorted = [...(items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    haptic('submitStart');
    try {
      await onAdd(trimmed, type, audience);
      setLabel('');
      haptic('successRamp');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sorted.length || busy) return;
    setBusy(true);
    setError(null);
    haptic('tap');
    const reordered = [...sorted];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    try {
      await onReorder(reordered.map((i) => i.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    haptic('tap');
    try {
      await onDeactivate(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div role="presentation" onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label="Manage check-in items"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">Manage check-in items</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-200">
            ✕
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {sorted.map((item, i) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0 || busy}
                  onClick={() => void move(i, -1)}
                  className="text-slate-500 disabled:opacity-30 hover:text-slate-200"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === sorted.length - 1 || busy}
                  onClick={() => void move(i, 1)}
                  className="text-slate-500 disabled:opacity-30 hover:text-slate-200"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{item.label}</p>
                <p className="text-[11px] text-slate-500">
                  {item.item_type === 'boolean' ? 'yes/no' : 'note'}
                  {item.audience === 'partner_note' ? ' · for partner' : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(item.id)}
                className="rounded-lg border border-rose-800/60 px-2 py-1 text-xs text-rose-300 transition active:scale-95 hover:border-rose-500"
              >
                Remove
              </button>
            </li>
          ))}
          {sorted.length === 0 && <p className="text-sm text-slate-500">No items yet.</p>}
        </ul>

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-800 pt-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Add item</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Did we water the plants?"
            maxLength={140}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <div className="flex flex-wrap gap-2">
            <Chip label="Yes/No" active={type === 'boolean'} onClick={() => setType('boolean')} />
            <Chip label="Note" active={type === 'text'} onClick={() => setType('text')} />
            <span className="mx-1 self-center text-slate-700">|</span>
            <Chip label="For me" active={audience === 'self'} onClick={() => setAudience('self')} />
            <Chip label="For partner" active={audience === 'partner_note'} onClick={() => setAudience('partner_note')} />
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            disabled={busy || !label.trim()}
            onClick={() => void handleAdd()}
            className="mt-1 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-50 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            Add item
          </button>
        </div>
      </div>
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition active:scale-95',
        active
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
