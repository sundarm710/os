// Single source of truth for the app's pages. When a third page lands
// (history? settings?), introduce react-router instead of extending this.

export type Page = 'journal' | 'calendar';

export const DEFAULT_PAGE: Page = 'journal';
