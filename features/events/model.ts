import type { TerminalEvent } from '@/lib/events/types';
import { getArchivedOrElapsedEvents, getEventDateTime, getFutureUpcomingEvent, getLiveEvents, getRequestWindowState, isPublicArtist, withEffectiveEventStatus } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import aboutContent from '@/features/about/content.json';

export const publicArtists = (event: TerminalEvent) => event.artists.filter(isPublicArtist);
export const eventHref = (id: string) => `/events/${encodeURIComponent(id)}`;
/** `TERMINAL [03] : Interstellar Junction` → `TERMINAL [03]`: the name narrow slots (chips, index lines, cells, BACK) print in full. */
export const sessionShort = (session: string) => session.split(/\s+:\s+/)[0].trim() || session;
/**
 * A session's own subtitle: the part of its name after ` : ` (`Interstellar Junction`). The stored
 * `subtitle` is used only for a name without one, and never when it is TERMINAL's own tagline,
 * which belongs to the brand (About), not to a session.
 */
export function eventSubtitle(event: Pick<TerminalEvent, 'session' | 'subtitle'>) {
  const named = event.session.split(/\s+:\s+/).slice(1).join(' : ').trim();
  if (named) return named;
  const stored = event.subtitle.trim();
  return stored && stored !== aboutContent.tagline ? stored : '';
}
export const statusLabel = (status: TerminalEvent['status']) => ({ LIVE: '진행 중', UPCOMING: '예정', ARCHIVED: '기록' })[status];
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
  if (event.status !== 'UPCOMING') return { canRequest: false, message: event.status === 'ARCHIVED' ? '이 이벤트의 접수는 종료되었습니다.' : '진행 중인 이벤트는 접수할 수 없습니다.' };
  if (target?.id !== event.id) return { canRequest: false, message: '현재는 가장 가까운 예정 이벤트만 접수합니다.' };
  const window = getRequestWindowState(event, ACCESS_WINDOW_DAYS,now);
  return { canRequest: window.isActive, message: window.isActive ? '게스트 신청을 접수하고 있습니다.' : `이벤트 시작 30일 전부터 신청할 수 있습니다. ${window.opensInDays ?? 0}일 후 열립니다.` };
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

/**
 * A Google Maps search for the venue by name and district. The stored coordinates are approximate,
 * so the place listing (its pin, its entrance) is found by name; an undisclosed venue gets no link.
 */
export function venueMapHref(event: Pick<TerminalEvent, 'venue' | 'district'>) {
  const venue = event.venue.trim();
  if (!venue || /^(TBA|TBD|CLASSIFIED|SECRET|미정|비공개)\b/i.test(venue)) return null;
  const query = [venue, event.district.replace(/\/+/g, ' ')].join(' ').replace(/\s+/g, ' ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
