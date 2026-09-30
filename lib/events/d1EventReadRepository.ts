import { eq } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';
import { artists, events } from '@/lib/db/schema';
import { parsePublicArtistRow, parsePublicEventRow } from './publicDtos';
import { withEffectiveEventStatus } from './lifecycle';

type EventDatabase = ReturnType<typeof getDb>;

export interface StoredEventRow {
  id: string;
  data: string;
}

export interface StoredArtistRow {
  id: string;
  eventId: string;
  data: string;
}

export async function listStoredEventRows(
  database: EventDatabase,
): Promise<StoredEventRow[]> {
  return database
    .select({ id: events.id, data: events.data })
    .from(events)
    .all();
}

export async function listStoredArtistRows(
  database: EventDatabase,
): Promise<StoredArtistRow[]> {
  return database
    .select({ id: artists.id, eventId: artists.eventId, data: artists.data })
    .from(artists)
    .all();
}

export async function listStoredArtistRowsByEvent(
  database: EventDatabase,
  eventId: string,
): Promise<StoredArtistRow[]> {
  return database
    .select({ id: artists.id, eventId: artists.eventId, data: artists.data })
    .from(artists)
    .where(eq(artists.eventId, eventId))
    .all();
}

/** One public projection shared by HTTP reads and the server-rendered stage. */
export async function listPublicEvents(database: EventDatabase) {
  const [eventRows, artistRows] = await Promise.all([
    listStoredEventRows(database),
    listStoredArtistRows(database),
  ]);
  const publicArtists = artistRows.map(row => ({
    eventId: row.eventId,
    artist: parsePublicArtistRow(row),
  }));
  const invalidArtistEventIds = new Set(
    publicArtists.filter(({ artist }) => artist === null).map(({ eventId }) => eventId),
  );
  const artistsByEventId = new Map<string, NonNullable<(typeof publicArtists)[number]['artist']>[]>();
  for (const { eventId, artist } of publicArtists) {
    if (artist) artistsByEventId.set(eventId, [...(artistsByEventId.get(eventId) ?? []), artist]);
  }
  const now = new Date();
  return eventRows.flatMap(row => {
    if (invalidArtistEventIds.has(row.id)) return [];
    const event = parsePublicEventRow(row, artistsByEventId.get(row.id) ?? []);
    return event ? [withEffectiveEventStatus(event, now)] : [];
  });
}
