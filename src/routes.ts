// Single source of truth for the app's pages. When a third page lands
// (history? settings?), introduce react-router instead of extending this.

export type Page = 'tasks' | 'journal' | 'daily-note' | 'calendar' | 'workouts' | 'learn' | 'people' | 'notes';

// Ordered tab metadata — drives both the TabBar (left→right) and the
// Shift+1…Shift+N keyboard shortcuts in App, so the two never diverge.
export const TABS: { id: Page; label: string; icon: string }[] = [
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'daily-note', label: 'Daily', icon: '📔' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'workouts', label: 'Workouts', icon: '🏋️' },
  { id: 'learn', label: 'Learn', icon: '🧠' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'notes', label: 'Notes', icon: '🗒️' },
];

export const PAGES: Page[] = TABS.map((t) => t.id);

export const DEFAULT_PAGE: Page = 'journal';
