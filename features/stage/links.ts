import type { TerminalEvent } from '@/lib/events/types';
import { EVENT_PAGE_SIZE, eventHref } from '@/features/events/model';
import type { PlateId, StageState } from './state';

/** S1 keeps the URL meaning of `/events?page=n`: four records a page, as before the stage. */
export const DIRECTORY_PAGE_SIZE = EVENT_PAGE_SIZE;

export const PLATE_META: Record<PlateId, { label: string; ko: string; href: string }> = {
  next: { label: 'NEXT', ko: '다음 행사', href: '/events' },
  events: { label: 'EVENTS', ko: '이벤트', href: '/events' },
  artists: { label: 'ARTISTS', ko: '아티스트', href: '/artists' },
  log: { label: 'LOG', ko: '방문자 로그', href: '/transmit' },
  signal: { label: 'SIGNAL', ko: '소식 신청', href: '/signal' },
  about: { label: 'ABOUT', ko: '소개', href: '/about' },
};

export const directoryHref = (page: number) => (page > 1 ? `/events?page=${page}` : '/events');

export const directoryPages = (count: number) => Math.max(1, Math.ceil(count / DIRECTORY_PAGE_SIZE));

/** The directory page that lists an event, so closing a session lands on its own row. */
export function directoryPageOf(ordered: readonly TerminalEvent[], eventId: string) {
  const index = ordered.findIndex(event => event.id === eventId);
  return index < 0 ? 1 : Math.floor(index / DIRECTORY_PAGE_SIZE) + 1;
}

/** One level up: detail → parent plate → home. */
export function parentHref(state: StageState | null, ordered: readonly TerminalEvent[]): string | null {
  if (!state || state.view === 'home') return null;
  if (state.view === 'plate') return '/';
  if (state.view === 'artist') return '/artists';
  return state.request ? eventHref(state.eventId) : directoryHref(directoryPageOf(ordered, state.eventId));
}
