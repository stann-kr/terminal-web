import type { TerminalEvent } from '@/lib/events/types';
import { getEventDateTime } from '@/lib/events/lifecycle';
import { sessionNamesBrand } from './metadata';
import { eventHref, publicArtists } from './model';

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

/**
 * One session as an iCalendar file. The data has a start time only, so the entry has no end
 * (calendars show it at the start) rather than a guessed one.
 */
export function eventCalendar(event: TerminalEvent, origin: string, now = new Date()): string | null {
  const start = getEventDateTime(event);
  if (!Number.isFinite(start.getTime())) return null;
  const url = `${origin}${eventHref(event.id)}`;
  const lineup = publicArtists(event).map((artist) => artist.name);
  const description = [event.subtitle, lineup.length ? `LINEUP: ${lineup.join(', ')}` : '', url]
    .filter(Boolean)
    .join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TERMINAL//Session//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${text(event.id)}@terminal.stann.kr`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `SUMMARY:${text(sessionNamesBrand(event.session) ? event.session : `TERMINAL ${event.session}`)}`,
    `LOCATION:${text(`${event.venue}, ${event.district}`)}`,
    `DESCRIPTION:${text(description)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')
    .concat('\r\n');
}
