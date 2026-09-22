import { useCallback, useEffect, useState } from 'react';
import {
  addChecklistItem,
  deactivateChecklistItem,
  editChecklistItem,
  fetchChecklistDay,
  fetchChecklistItems,
  reorderChecklistItems,
  type ChecklistAnswer,
  type ChecklistAudience,
  type ChecklistDayItem,
  type ChecklistItemType,
  type PartnerChecklistItem,
} from './api';
import { drainQueue } from './sync';
import { enqueue, newClientId } from './queue';

export function usePartnerChecklist(entryDate: string) {
  const [items, setItems] = useState<PartnerChecklistItem[] | null>(null);
  const [dayItems, setDayItems] = useState<ChecklistDayItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setItems(await fetchChecklistItems());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      setDayItems(await fetchChecklistDay(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadDay(entryDate);
  }, [entryDate, loadDay]);

  // Queue-first submit, like journal/calendar — the upsert is idempotent on
  // (item_id, person, entry_date), so a retried queue entry just overwrites.
  const submit = useCallback(
    async (date: string, answers: ChecklistAnswer[]) => {
      const client_id = newClientId();
      await enqueue('partner-checklist', { client_id, entry_date: date, answers });
      await drainQueue();
      await loadDay(date);
    },
    [loadDay],
  );

  const addItem = useCallback(
    async (label: string, itemType: ChecklistItemType, audience: ChecklistAudience) => {
      const created = await addChecklistItem(label, itemType, audience);
      setItems((prev) => (prev ? [...prev, created] : [created]));
      return created;
    },
    [],
  );

  const editItem = useCallback(
    async (id: string, updates: Partial<Pick<PartnerChecklistItem, 'label' | 'item_type' | 'audience'>>) => {
      const updated = await editChecklistItem(id, updates);
      setItems((prev) => (prev ? prev.map((i) => (i.id === id ? updated : i)) : prev));
      return updated;
    },
    [],
  );

  const deactivateItem = useCallback(async (id: string) => {
    await deactivateChecklistItem(id);
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const reorderItems = useCallback(async (orderedIds: string[]) => {
    await reorderChecklistItems(orderedIds);
    await loadItems();
  }, [loadItems]);

  return {
    items,
    dayItems,
    loading,
    error,
    loadDay,
    submit,
    addItem,
    editItem,
    deactivateItem,
    reorderItems,
  };
}
