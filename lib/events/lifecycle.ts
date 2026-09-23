import type { EventStatus, TerminalEvent } from './types';

const MILLISECONDS_PER_DAY = 86_400_000;

export function getEventDateTime(event: Pick<TerminalEvent, 'date' | 'time'>): Date {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  const time = /^([01]\d|2[0-3]):([0-5]\d)(?: KST)?$/.exec(event.time);
  if (!date || !time) return new Date(Number.NaN);

  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
    return new Date(Number.NaN);
  }

  return new Date(`${event.date}T${time[1]}:${time[2]}:00+09:00`);
}

export function isValidEventDateTime(event: Pick<TerminalEvent, 'date' | 'time'>): boolean {
  return !Number.isNaN(getEventDateTime(event).getTime());
}

export function isEventElapsed(
  event: Pick<TerminalEvent, 'date' | 'time'>,
  now: Date = new Date(),
): boolean {
  const eventTime = getEventDateTime(event).getTime();
  return !Number.isNaN(eventTime) && eventTime <= now.getTime();
}

export function formatEventDate(
  event: Pick<TerminalEvent, 'date' | 'time'>,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' },
): string {
  const date = getEventDateTime(event);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(locale, { ...options, timeZone: 'Asia/Seoul' });
}

/**
 * Date/time is the source of truth for scheduled UPCOMING events once they
 * have elapsed. LIVE has no end-time model, so its stored status is retained.
 */
export function getEffectiveEventStatus(
  event: Pick<TerminalEvent, 'date' | 'time' | 'status'>,
  now: Date = new Date(),
): EventStatus {
  return event.status === 'ARCHIVED'
    || (event.status === 'UPCOMING' && (!isValidEventDateTime(event) || isEventElapsed(event, now)))
    ? 'ARCHIVED'
    : event.status;
}

export function withEffectiveEventStatus<T extends TerminalEvent>(
  event: T,
  now: Date = new Date(),
): T {
  return { ...event, status: getEffectiveEventStatus(event, now) };
}

export function getFutureUpcomingEvent(
  events: readonly TerminalEvent[],
  now: Date = new Date(),
): TerminalEvent | null {
  return [...events]
    .filter((event) => getEffectiveEventStatus(event, now) === 'UPCOMING')
    .sort((a, b) => compareEventTimes(a, b) || compareEventIds(a, b))[0] ?? null;
}

export function getArchivedOrElapsedEvents(
  events: readonly TerminalEvent[],
  now: Date = new Date(),
): TerminalEvent[] {
  return events
    .filter((event) => getEffectiveEventStatus(event, now) === 'ARCHIVED')
    .sort((a, b) => compareEventTimes(b, a) || compareEventIds(a, b));
}

function compareEventIds(a: TerminalEvent, b: TerminalEvent): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareEventTimes(a: TerminalEvent, b: TerminalEvent): number {
  const aTime = getEventDateTime(a).getTime();
  const bTime = getEventDateTime(b).getTime();
  return (Number.isNaN(aTime) ? -Infinity : aTime) - (Number.isNaN(bTime) ? -Infinity : bTime);
}

export function getLiveEvents(
  events: readonly TerminalEvent[],
  now: Date = new Date(),
): TerminalEvent[] {
  return events
    .filter((event) => getEffectiveEventStatus(event, now) === 'LIVE')
    .sort((a, b) => compareEventTimes(b, a) || compareEventIds(a, b));
}

export function getDefaultEvent(
  events: readonly TerminalEvent[],
  now: Date = new Date(),
): TerminalEvent | null {
  const event = getLiveEvents(events, now)[0]
    ?? getFutureUpcomingEvent(events, now)
    ?? getArchivedOrElapsedEvents(events, now)[0];
  return event ? withEffectiveEventStatus(event, now) : null;
}

export function selectEvent(
  events: readonly TerminalEvent[],
  requestedEventId?: string | null,
  now: Date = new Date(),
): TerminalEvent | null {
  const requestedEvent = events.find((event) => event.id === requestedEventId);
  return requestedEvent ? withEffectiveEventStatus(requestedEvent, now) : getDefaultEvent(events, now);
}

export function getEventBoundaryTimes(
  events: readonly TerminalEvent[],
  accessWindowDays?: number,
): number[] {
  const times = events
    .filter((event) => event.status === 'UPCOMING')
    .flatMap((event) => {
      const startsAt = getEventDateTime(event).getTime();
      if (Number.isNaN(startsAt)) return [];
      return accessWindowDays !== undefined && Number.isFinite(accessWindowDays) && accessWindowDays >= 0
        ? [startsAt - accessWindowDays * MILLISECONDS_PER_DAY, startsAt]
        : [startsAt];
    });
  return [...new Set(times)].sort((a, b) => a - b);
}

export interface RequestWindowState {
  daysUntil: number;
  isActive: boolean;
  isElapsed: boolean;
  opensInDays: number | null;
}

export function getRequestWindowState(
  event: Pick<TerminalEvent, 'date' | 'time'>,
  accessWindowDays: number,
  now: Date = new Date(),
): RequestWindowState {
  const eventTime = getEventDateTime(event).getTime();
  if (Number.isNaN(eventTime)) {
    return { daysUntil: -1, isElapsed: true, opensInDays: null, isActive: false };
  }

  const millisecondsUntil = eventTime - now.getTime();
  const isElapsed = millisecondsUntil <= 0;
  const daysUntil = isElapsed
    ? Math.min(-1, Math.floor(millisecondsUntil / MILLISECONDS_PER_DAY))
    : Math.ceil(millisecondsUntil / MILLISECONDS_PER_DAY);
  const opensInDays = isElapsed ? null : Math.max(0, daysUntil - accessWindowDays);

  return {
    daysUntil,
    isElapsed,
    opensInDays,
    isActive: !isElapsed && daysUntil <= accessWindowDays,
  };
}
