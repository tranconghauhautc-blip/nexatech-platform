const STORAGE_KEY = 'nt_recently_viewed';
const MAX_ITEMS = 12;

export interface RecentlyViewedEntry {
  id: string;
  slug: string;
  name: string;
  price: number;
  thumbnailMediaId?: string | null;
  brandName?: string | null;
  viewedAt: string;
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentlyViewedEntry[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(
  entry: Omit<RecentlyViewedEntry, 'viewedAt'>,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const existing = getRecentlyViewed().filter((item) => item.id !== entry.id);
  const next = [
    { ...entry, viewedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}
