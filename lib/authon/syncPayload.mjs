/**
 * The guest payload authon's `/api/internal/sync-guest` takes, built from one stored access request.
 * Shared by the worker (lib/authon/syncGuest.ts) and the resend script (scripts/authon-sync.mjs), so
 * a resend sends exactly what the first send did: authon answers a changed payload under the same
 * request id with 409.
 *
 * Plain JavaScript so the operation script can import it without a build step. Nothing runs on import.
 */

/** The access request columns the payload needs, as selected by AUTHON_SYNC_ROW_SQL. */
export const AUTHON_SYNC_ROW_COLUMNS = `
  r.id AS id,
  r.name AS name,
  r.email AS email,
  r.instagram AS instagram,
  r.invited_by AS invitedBy,
  r.created_at AS createdAt,
  e.data AS eventData,
  a.data AS artistData`;

/** One access request with its event and artist, by request id. */
export const AUTHON_SYNC_ROW_SQL = `
  SELECT ${AUTHON_SYNC_ROW_COLUMNS}
  FROM access_requests r
  JOIN events e ON e.id = r.event_id
  LEFT JOIN artists a ON a.id = r.artist_id
  WHERE r.id = ?`;

const MAX_GUEST_LIMIT = 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string | null} the trimmed text, or null when empty or too long
 */
function boundedText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function parseObject(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {{
 *   id: unknown, name: unknown, email: unknown, instagram: unknown, invitedBy: unknown,
 *   createdAt: unknown, eventData: unknown, artistData: unknown,
 * }} AuthonSyncRow
 *
 * @typedef {{
 *   terminalRequestId: string, name: string, email: string | null, instagram: string | null,
 *   date: string, createdAt: string | null, artistName: string | null, guestLimit: number | null,
 * }} AuthonGuestPayload
 */

/**
 * The payload for one stored request, or null when the row cannot make one (no name, or an event
 * without a calendar date). Empty optional fields go as null, which authon reads as absent.
 * @param {AuthonSyncRow} row
 * @returns {AuthonGuestPayload | null}
 */
export function buildAuthonGuestPayload(row) {
  const terminalRequestId = boundedText(row.id, 128);
  const name = boundedText(row.name, 100);
  const event = parseObject(row.eventData);
  const date = typeof event?.date === 'string' && ISO_DATE.test(event.date) ? event.date : null;
  if (!terminalRequestId || !name || !date) return null;

  const artist = parseObject(row.artistData);
  const artistName = boundedText(row.invitedBy, 100) ?? boundedText(artist?.name, 100);
  const limit = artist?.guestLimit;
  const guestLimit = Number.isInteger(limit) && /** @type {number} */ (limit) >= 1 && /** @type {number} */ (limit) <= MAX_GUEST_LIMIT
    ? /** @type {number} */ (limit)
    : null;

  return {
    terminalRequestId,
    name,
    email: boundedText(row.email, 254),
    instagram: boundedText(row.instagram, 100),
    date,
    createdAt: typeof row.createdAt === 'string' && ISO_TIMESTAMP.test(row.createdAt) ? row.createdAt : null,
    artistName,
    guestLimit,
  };
}

/**
 * What authon's reply means for the sender: done (created or already there), retry later (no venue
 * event yet, or a passing failure), or a fault to look into (refused payload or credentials).
 * @param {number} status
 * @param {unknown} body
 * @returns {'synced' | 'retry' | 'rejected'}
 */
export function classifyAuthonReply(status, body) {
  if (status === 200 && /** @type {{ ok?: unknown } | null} */ (body)?.ok === true) return 'synced';
  if (status === 503 || status === 429 || status >= 500) return 'retry';
  return 'rejected';
}
