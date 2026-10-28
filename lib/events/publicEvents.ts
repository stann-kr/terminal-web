import type { getDb } from '@/lib/db/client';
import {
  listStoredArtistRows,
  listStoredEventRows,
  type StoredArtistRow,
  type StoredEventRow,
} from './d1EventReadRepository';
import { hasConfiguredAccessCode } from '@/lib/gate/createAccessRequest';
import { withEffectiveEventStatus } from './lifecycle';
import { parsePublicArtistRow, parsePublicEventRow } from './publicDtos';
import type { Artist, TerminalEvent } from './types';

/**
 * Stored rows → the public events, with the status the clock gives them. An event whose artist
 * rows do not parse is left out whole rather than shown with a partial lineup. `guestAccess` says
 * whether any of its artist rows (hidden ones included) carries a guest code.
 */
export function toPublicEvents(
  eventRows: readonly StoredEventRow[],
  artistRows: readonly StoredArtistRow[],
  now: Date,
): TerminalEvent[] {
  const invalid = new Set<string>();
  const artistsByEvent: Record<string, Artist[]> = {};
  const rowsByEvent: Record<string, StoredArtistRow[]> = {};
  for (const row of artistRows) {
    (rowsByEvent[row.eventId] ??= []).push(row);
    const artist = parsePublicArtistRow(row);
    if (artist) (artistsByEvent[row.eventId] ??= []).push(artist);
    else invalid.add(row.eventId);
  }
  return eventRows.flatMap((row) => {
    if (invalid.has(row.id)) return [];
    const event = parsePublicEventRow(row, artistsByEvent[row.id] ?? []);
    if (!event) return [];
    const guestAccess = hasConfiguredAccessCode(rowsByEvent[row.id] ?? []);
    return [withEffectiveEventStatus({ ...event, guestAccess }, now)];
  });
}

export async function loadPublicEvents(
  database: ReturnType<typeof getDb>,
  now = new Date(),
): Promise<TerminalEvent[]> {
  const [eventRows, artistRows] = await Promise.all([
    listStoredEventRows(database),
    listStoredArtistRows(database),
  ]);
  return toPublicEvents(eventRows, artistRows, now);
}
