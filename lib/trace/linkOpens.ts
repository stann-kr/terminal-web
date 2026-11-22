/**
 * How often an artist's invite link is opened in a browser, per KST day, artist and link tag
 * (`?from=`). Only totals are kept: no address, hash or cookie names the person who opened it. The
 * browser itself marks a link as counted for the day (features/access/linkOpenMark), so a reload
 * does not count again; a preview crawler never runs the page's script and is never counted.
 */
export const RECORD_LINK_OPEN_SQL = `INSERT INTO link_opens (day, event_id, artist_id, source, opens)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(day, event_id, artist_id, source) DO UPDATE SET opens = opens + 1`;

/** The KST calendar day of `now` (YYYY-MM-DD). */
export const kstDay = (now: Date): string => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export async function recordLinkOpen(
  database: Pick<D1Database, 'prepare'>,
  open: { eventId: string; artistId: string; source: string | null; now: Date },
): Promise<void> {
  await database.prepare(RECORD_LINK_OPEN_SQL).bind(kstDay(open.now), open.eventId, open.artistId, open.source ?? '').run();
}
