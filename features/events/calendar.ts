import type { TerminalEvent } from '@/lib/events/types';
import { getEventDateTime, getEventEndTime } from '@/lib/events/lifecycle';
import { sessionNamesBrand } from './metadata';
import { eventHref, eventSubtitle, publicArtists } from './model';

/** The subscription feed's path; calendars re-read it, so a changed session reaches every subscriber. */
export const CALENDAR_FEED_PATH = '/calendar.ics';

/**
 * Where the subscribe key leads. Apple calendars take a `webcal:` link and offer to subscribe;
 * elsewhere Google Calendar's own subscribe page takes the feed.
 */
export function calendarSubscribeHref(origin: string, apple: boolean) {
  const feed = `${origin.replace(/^https?:/, 'webcal:')}${CALENDAR_FEED_PATH}`;
  return apple ? feed : `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`;
}

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** RFC 5545 TEXT: backslash, semicolon, comma and newlines are escaped. */
const text = (value: string) => value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n');
/** Lines longer than 75 octets continue on the next line after a space. */
function fold(line: string) {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    if (bytes.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  return [...parts, current].join('\r\n ');
}

function sessionEntry(event: TerminalEvent, origin: string, now: Date): string[] {
  const start = getEventDateTime(event);
  if (!Number.isFinite(start.getTime())) return [];
  const end = getEventEndTime(event);
  const url = `${origin}${eventHref(event.id)}`;
  const lineup = publicArtists(event).map((artist) => artist.name);
  const subtitle = eventSubtitle(event);
  const description = [event.session.includes(subtitle) ? '' : subtitle, lineup.length ? `LINEUP: ${lineup.join(', ')}` : '', url]
    .filter(Boolean)
    .join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:${text(event.id)}@terminal.stann.kr`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    ...(end ? [`DTEND:${stamp(end)}`] : []),
    `SUMMARY:${text(sessionNamesBrand(event.session) ? event.session : `TERMINAL ${event.session}`)}`,
    `LOCATION:${text(`${event.venue}, ${event.district}`)}`,
    `DESCRIPTION:${text(description)}`,
    `URL:${url}`,
    'END:VEVENT',
  ];
}

/**
 * Every public session as one iCalendar feed. Entries keep their UID, so a calendar that re-reads
 * the feed updates them in place. An entry ends where the data says (its end time, or the last
 * published slot); without either it has no end rather than a guessed one.
 */
export function sessionsCalendar(events: readonly TerminalEvent[], origin: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TERMINAL//Sessions//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'NAME:TERMINAL',
    'X-WR-CALNAME:TERMINAL',
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap((event) => sessionEntry(event, origin, now)),
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')
    .concat('\r\n');
}
