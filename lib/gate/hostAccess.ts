import { inspectArtistAccessData, type ArtistAccessData } from './createAccessRequest';
import { isArtistId, verifyHostLink } from './hostLink';

/**
 * The artist a host link opens, once its token holds for the artist's current guest code; `null`
 * for every way it can fail, so callers answer them all alike.
 */
export async function verifiedHostArtist(
  database: D1Database,
  secret: string,
  artistId: string,
  token: string,
): Promise<{ eventId: string; access: ArtistAccessData } | null> {
  if (!isArtistId(artistId)) return null;
  const row = await database.prepare("SELECT event_id, data FROM artists WHERE id = ?")
    .bind(artistId)
    .first<{ event_id: string; data: string }>();
  const access = row ? inspectArtistAccessData(row.data) : null;
  if (!row || access?.kind !== 'configured') return null;
  return await verifyHostLink(secret, artistId, access.data.guestCode, token)
    ? { eventId: row.event_id, access: access.data }
    : null;
}
