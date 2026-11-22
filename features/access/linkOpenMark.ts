/**
 * Marks an invite link as counted in this browser for the KST day, so a reload or a second tab does
 * not count it again (lib/trace/linkOpens). Storage that throws (a private window, blocked site
 * data) counts each open: a slightly high count beats none.
 */
const KEY = 'tw_link_open';

const kstDay = (now: Date) => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** True the first time today this browser opens this event's link with this code; marks it counted. */
export function takeLinkOpen(eventId: string, code: string, now: Date = new Date(), storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): boolean {
  const mark = `${eventId}:${code.toUpperCase()}:${kstDay(now)}`;
  if (!storage) return true;
  try {
    if (storage.getItem(KEY) === mark) return false;
    storage.setItem(KEY, mark);
  } catch {
    // Unreadable storage: count it.
  }
  return true;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
