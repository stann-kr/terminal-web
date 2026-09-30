import type { Artist, TerminalEvent } from '@/lib/events/types';
import { isPublicArtist } from '../events/data';

export interface ArtistAppearance { artist: Artist; event: TerminalEvent }
export interface ArtistRecord {
  id: string;
  name: string;
  origin: string;
  appearances: ArtistAppearance[];
  eventCount: number;
  firstDate: string;
  lastDate: string;
}

/** A public-name index across event records, not a new canonical artist identity. */
export function buildArtistRecords(events: TerminalEvent[]): ArtistRecord[] {
  const index = new Map<string, ArtistRecord>();
  for (const event of [...events].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    for (const artist of event.artists.filter(isPublicArtist)) {
      const key = [artist.name, artist.origin].map(value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).join('\u0000');
      let record = index.get(key);
      if (!record) {
        record = { id: artist.id, name: artist.name, origin: artist.origin, appearances: [], eventCount: 0, firstDate: event.date, lastDate: event.date };
        index.set(key, record);
      }
      record.appearances.push({ event, artist });
      record.lastDate = event.date;
    }
  }
  return [...index.values()].map(record => ({ ...record, eventCount: new Set(record.appearances.map(item => item.event.id)).size, appearances: record.appearances.reverse() }))
    .sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
}
