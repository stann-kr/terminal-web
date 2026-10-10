import type { Artist, EventStatus, TerminalEvent } from './types';

const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const KST_OFFSET_MS = 9 * MILLISECONDS_PER_HOUR;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(?: KST)?$/;
/** A running-order slot: `23:00 - 01:00`, `01:00–02:30` (hyphen, en or em dash, or tilde). */
const SLOT = /^([01]\d|2[0-3]):([0-5]\d)\s*[-–—~]\s*([01]\d|2[0-3]):([0-5]\d)(?: KST)?$/;

/** What the lifecycle reads of an event: its start and stored status, and how it ends when the data says. */
export type LifecycleEvent = Pick<TerminalEvent, 'date' | 'time' | 'status'> & Partial<Pick<TerminalEvent, 'endTime' | 'artists'>>;

/** Only confirmed and archived appearances are published; the rest of the running order is not shown. */
export const isPublicArtist = (artist: Artist) => artist.status === 'CONFIRMED' || artist.status === 'ARCHIVED';

export function getEventDateTime(event: Pick<TerminalEvent, 'date' | 'time'>): Date {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  const time = CLOCK.exec(event.time);
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

/** The moment a KST wall-clock time falls on the KST calendar day of `anchor`. */
function onKstDay(anchor: number, hours: number, minutes: number) {
  const midnight = Math.floor((anchor + KST_OFFSET_MS) / MILLISECONDS_PER_DAY) * MILLISECONDS_PER_DAY - KST_OFFSET_MS;
  return midnight + hours * MILLISECONDS_PER_HOUR + minutes * 60_000;
}

/** The first time after `anchor` that the clock reads this: a night that ends at 05:00 ends the next morning. */
function clockAfter(anchor: number, hours: number, minutes: number) {
  const time = onKstDay(anchor, hours, minutes);
  return time > anchor ? time : time + MILLISECONDS_PER_DAY;
}

/** The time the clock reads this nearest to `anchor`, within half a day either side. */
function clockNear(anchor: number, hours: number, minutes: number) {
  const time = onKstDay(anchor, hours, minutes);
  if (time < anchor - 12 * MILLISECONDS_PER_HOUR) return time + MILLISECONDS_PER_DAY;
  return time >= anchor + 12 * MILLISECONDS_PER_HOUR ? time - MILLISECONDS_PER_DAY : time;
}

export interface SlotTimes {
  start: Date;
  end: Date;
}

/**
 * When a running-order slot (`01:00 - 03:00`) runs, placed in the night of its event: it starts at
 * the clock time nearest the event's start and ends at the first such time after that. A slot
 * without both times (TBA) has none; times are never guessed.
 */
export function getSlotTimes(event: Pick<TerminalEvent, 'date' | 'time'>, slot: string): SlotTimes | null {
  const start = getEventDateTime(event).getTime();
  const match = SLOT.exec(slot.trim());
  if (Number.isNaN(start) || !match) return null;
  const from = clockNear(start, Number(match[1]), Number(match[2]));
  return { start: new Date(from), end: new Date(clockAfter(from, Number(match[3]), Number(match[4]))) };
}

/**
 * When the event ends: its `endTime` (the first such clock time after the start), or else the end of
 * the last slot when every published slot has its times. Null when neither says; the end is never
 * guessed.
 */
export function getEventEndTime(event: Omit<LifecycleEvent, 'status'>): Date | null {
  const start = getEventDateTime(event).getTime();
  if (Number.isNaN(start)) return null;
  const end = event.endTime === undefined ? null : CLOCK.exec(event.endTime);
  if (end) return new Date(clockAfter(start, Number(end[1]), Number(end[2])));
  const slots = (event.artists ?? []).filter(isPublicArtist).map((artist) => getSlotTimes(event, artist.time));
  const ends = slots.flatMap((slot) => (slot ? [slot.end.getTime()] : []));
  return ends.length && ends.length === slots.length ? new Date(Math.max(...ends)) : null;
}

/**
 * The clock is the source of truth for scheduled events: an UPCOMING event is LIVE from its start
 * until its end and ARCHIVED after, and a stored LIVE one is archived once its end has passed. An
 * event whose end is unknown is archived at its start (UPCOMING) or kept as stored (LIVE).
 */
export function getEffectiveEventStatus(
  event: LifecycleEvent,
  now: Date = new Date(),
): EventStatus {
  if (event.status === 'ARCHIVED') return 'ARCHIVED';
  const end = getEventEndTime(event)?.getTime();
  if (end !== undefined && now.getTime() >= end) return 'ARCHIVED';
  if (event.status === 'LIVE') return 'LIVE';
  if (!isValidEventDateTime(event)) return 'ARCHIVED';
  if (!isEventElapsed(event, now)) return 'UPCOMING';
  return end === undefined ? 'ARCHIVED' : 'LIVE';
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

/**
 * The moments a scheduled event changes on its own: guest requests open, it starts, it ends, and each
 * published slot starts and ends (the running order marks the slot the timetable is on).
 */
export function getEventBoundaryTimes(
  events: readonly TerminalEvent[],
  accessWindowDays?: number,
): number[] {
  const times = events
    .filter((event) => event.status !== 'ARCHIVED')
    .flatMap((event) => {
      const startsAt = getEventDateTime(event).getTime();
      if (Number.isNaN(startsAt)) return [];
      const opens = event.status === 'UPCOMING'
        && accessWindowDays !== undefined && Number.isFinite(accessWindowDays) && accessWindowDays >= 0
        ? [startsAt - accessWindowDays * MILLISECONDS_PER_DAY]
        : [];
      const end = getEventEndTime(event);
      const slots = event.artists.filter(isPublicArtist).flatMap((artist) => {
        const slot = getSlotTimes(event, artist.time);
        return slot ? [slot.start.getTime(), slot.end.getTime()] : [];
      });
      return [...opens, ...(event.status === 'UPCOMING' ? [startsAt] : []), ...(end ? [end.getTime()] : []), ...slots];
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
