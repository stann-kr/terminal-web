import type { Artist, TerminalEvent } from '@/lib/events/types';
import { getFutureUpcomingEvent, getRequestWindowState } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';

export const isPublicArtist = (artist: Artist) => artist.status === 'CONFIRMED' || artist.status === 'ARCHIVED';
export const publicArtists = (event: TerminalEvent) => event.artists.filter(isPublicArtist);
export const eventHref = (id: string) => `/events/${encodeURIComponent(id)}`;
export const statusLabel = (status: TerminalEvent['status']) => ({ LIVE: '진행 중', UPCOMING: '예정', ARCHIVED: '행사 기록' })[status];
export function paragraphs(value: unknown, language: 'ko'|'en'): string[] {
  if (typeof value === 'string') return value.trim() ? value.split(/\n\s*\n/).filter(Boolean) : [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && !!item.trim());
  if (value && typeof value === 'object') {
    const record = value as Record<string,unknown>;
    return paragraphs(record[language],language);
  }
  return [];
}
export function accessAvailability(event: TerminalEvent, events: TerminalEvent[], now: Date) {
  const target = getFutureUpcomingEvent(events,now);
  if (event.status !== 'UPCOMING') return { canRequest: false, message: event.status === 'ARCHIVED' ? '이 행사의 접수는 종료되었습니다.' : '진행 중인 행사는 접수할 수 없습니다.' };
  if (target?.id !== event.id) return { canRequest: false, message: '현재는 가장 가까운 예정 행사만 접수합니다.' };
  const window = getRequestWindowState(event, ACCESS_WINDOW_DAYS,now);
  return { canRequest: window.isActive, message: window.isActive ? '게스트 신청을 접수하고 있습니다.' : `행사 시작 30일 전부터 신청할 수 있습니다. ${window.opensInDays ?? 0}일 후 열립니다.` };
}
export function pageNumber(value: string | null, max = 1000) { return value && /^[1-9]\d*$/.test(value) && Number(value) <= max ? Number(value) : 1; }
