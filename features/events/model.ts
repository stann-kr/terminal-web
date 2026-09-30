import type { Artist, TerminalEvent } from '@/lib/events/types';
import { getArchivedOrElapsedEvents, getEventDateTime, getFutureUpcomingEvent, getLiveEvents, getRequestWindowState, withEffectiveEventStatus } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';

export const isPublicArtist = (artist: Artist) => artist.status === 'CONFIRMED' || artist.status === 'ARCHIVED';
export const publicArtists = (event: TerminalEvent) => event.artists.filter(isPublicArtist);
export const eventHref = (id: string) => `/events/${encodeURIComponent(id)}`;
export const statusLabel = (status: TerminalEvent['status']) => ({ LIVE: '진행 중', UPCOMING: '예정', ARCHIVED: '행사 기록' })[status];
export function orderEventDirectory(events: readonly TerminalEvent[], now = new Date()) {
  const effective = events.map(event => withEffectiveEventStatus(event,now));
  const upcoming = effective.filter(event => event.status === 'UPCOMING').sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id.localeCompare(b.id));
  return [...getLiveEvents(effective,now),...upcoming,...getArchivedOrElapsedEvents(effective,now)];
}
export function paragraphs(value: unknown, language: 'ko'|'en'): string[] {
  if (typeof value === 'string') return value.trim() ? value.split(/\n\s*\n/).filter(Boolean) : [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && !!item.trim());
  if (value && typeof value === 'object') {
    const record = value as Record<string,unknown>;
    return paragraphs(record[language],language);
  }
  return [];
}
/** Whether any of these texts is written in both languages (only then is there a language to switch). */
export const bilingual = (...values: unknown[]) =>
  values.some(value => !!value && typeof value === 'object' && !Array.isArray(value)
    && paragraphs(value, 'ko').length > 0 && paragraphs(value, 'en').length > 0);
/** A line drawn only of box or rule characters (a text-art frame): it is decoration, and its width breaks. */
export const isRuleLine = (line: string) => line.trim().length >= 3 && /^[\s\u2500-\u257f\-=_+|~]+$/.test(line);
export function accessAvailability(event: TerminalEvent, events: TerminalEvent[], now: Date) {
  const target = getFutureUpcomingEvent(events,now);
  if (event.status !== 'UPCOMING') return { canRequest: false, message: event.status === 'ARCHIVED' ? '이 행사의 접수는 종료되었습니다.' : '진행 중인 행사는 접수할 수 없습니다.' };
  if (target?.id !== event.id) return { canRequest: false, message: '현재는 가장 가까운 예정 행사만 접수합니다.' };
  const window = getRequestWindowState(event, ACCESS_WINDOW_DAYS,now);
  return { canRequest: window.isActive, message: window.isActive ? '게스트 신청을 접수하고 있습니다.' : `행사 시작 30일 전부터 신청할 수 있습니다. ${window.opensInDays ?? 0}일 후 열립니다.` };
}
export function pageNumber(value: string | null, max = 1000) { return value && /^[1-9]\d*$/.test(value) && Number(value) <= max ? Number(value) : 1; }

const KST_OFFSET_MS = 9 * 3_600_000;
const kstDay = (time: number) => Math.floor((time + KST_OFFSET_MS) / 86_400_000);
/** `D-12` by KST calendar days (a session tonight is `D-DAY`), or the state once it has started. */
export function dayMark(event: TerminalEvent, now: Date) {
  if (event.status === 'LIVE') return 'LIVE';
  if (event.status === 'ARCHIVED') return 'ARCHIVE';
  const start = getEventDateTime(event).getTime();
  if (!Number.isFinite(start)) return 'TBA';
  const days = kstDay(start) - kstDay(now.getTime());
  return days <= 0 ? 'D-DAY' : `D-${days}`;
}

/** `37.5335° N, 126.9958° E` → a Kakao Map pin with the venue name, or `null` when there are no coordinates. */
export function venueMapHref(event: Pick<TerminalEvent, 'venue' | 'coords'>) {
  const match = /^\s*(\d{1,2}(?:\.\d+)?)°\s*([NS])\s*,\s*(\d{1,3}(?:\.\d+)?)°\s*([EW])\s*$/i.exec(event.coords);
  if (!match) return null;
  const lat = Number(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
  const lng = Number(match[3]) * (match[4].toUpperCase() === 'W' ? -1 : 1);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(event.venue.replace(/,/g, ' '))},${lat},${lng}`;
}
