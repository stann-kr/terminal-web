'use client';

import { useSyncExternalStore } from 'react';
import { useUrlQueryState } from '@/lib/useUrlQueryState';

const compactQuery = '(max-width: 1279px), (max-height: 799px)';
function subscribe(change: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}
export function useCompactViewport() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(compactQuery).matches, () => false);
}

/** An item ID anchors the view through resize, language changes and history navigation. */
export function useRecordWindow<T extends { id: string }>(records: T[], regular: number, compact: number, queryKey = 'from') {
  const [from, setFrom] = useUrlQueryState(queryKey);
  const small = useCompactViewport();
  const size = small ? compact : regular;
  const offset = Math.max(0, records.findIndex(record => record.id === from));
  return {
    records: records.slice(offset, offset + size),
    offset, size, total: records.length,
    hasPrevious: offset > 0,
    hasNext: offset + size < records.length,
    previous: () => setFrom(records[Math.max(0, offset - size)]?.id ?? ''),
    next: () => setFrom(records[Math.min(records.length - 1, offset + size)]?.id ?? ''),
  };
}
