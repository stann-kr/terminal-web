import { isJsonObject } from '../api/validation';
import { prepareGateSignalSubscriptionInsert } from '../signal/d1SignalSubscriptionRepository';

/**
 * One guest per event: the same Instagram id (case and a leading @ aside), or the same email when
 * both left one. Email is optional, so the Instagram id is the duplicate key that always exists.
 */
const SAME_GUEST = `(
      lower(ltrim(instagram, '@')) = ?
      OR (email IS NOT NULL AND email = ?)
    )`;

export const ACCESS_REQUEST_INSERT_SQL = `
  INSERT INTO access_requests (
    id,
    event_id,
    artist_id,
    invited_by,
    name,
    email,
    instagram,
    privacy_consent,
    marketing_consent,
    created_at
  )
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM access_requests
    WHERE event_id = ? AND ${SAME_GUEST}
  )
  AND (
    ? IS NULL
    OR (
      SELECT COUNT(*)
      FROM access_requests
      WHERE event_id = ? AND artist_id = ?
    ) < ?
  )
  ON CONFLICT DO NOTHING
`;

/** The waitlist keeps no email, so a guest there is known by the Instagram id alone. */
const SAME_WAITLISTED = `lower(ltrim(instagram, '@')) = ?`;

/**
 * A request the limit turned away waits here instead, in the same batch right after the insert
 * that failed: it lands only while the guest is on neither list and the code really is full, so a
 * request that did get in (or was a repeat) never also waits.
 */
export const WAITLIST_INSERT_SQL = `
  INSERT INTO access_waitlist (
    id,
    event_id,
    artist_id,
    invited_by,
    name,
    instagram,
    privacy_consent,
    created_at
  )
  SELECT ?, ?, ?, ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM access_requests
    WHERE event_id = ? AND ${SAME_GUEST}
  )
  AND NOT EXISTS (
    SELECT 1
    FROM access_waitlist
    WHERE event_id = ? AND ${SAME_WAITLISTED}
  )
  AND (
    SELECT COUNT(*)
    FROM access_requests
    WHERE event_id = ? AND artist_id = ?
  ) >= ?
  ON CONFLICT DO NOTHING
`;

/** A waiting guest who got onto a list another way (another code, or the artist) waits no more. */
const WAITLIST_CLEAR_SQL = `
  DELETE FROM access_waitlist
  WHERE event_id = ? AND ${SAME_WAITLISTED}
    AND EXISTS (
      SELECT 1
      FROM access_requests
      WHERE id = ?
    )
`;

const REJECTION_STATE_SQL = `
  SELECT
    EXISTS (
      SELECT 1
      FROM access_requests
      WHERE event_id = ? AND ${SAME_GUEST}
    ) AS is_duplicate,
    (
      SELECT COUNT(*)
      FROM access_requests
      WHERE event_id = ? AND artist_id = ?
    ) AS guest_count,
    EXISTS (
      SELECT 1
      FROM access_waitlist
      WHERE event_id = ? AND ${SAME_WAITLISTED}
    ) AS is_waitlisted
`;

export interface AtomicAccessRequestInput {
  id: string;
  signalId: string;
  eventId: string;
  artistId: string;
  invitedBy: string | null;
  name: string;
  email: string | null;
  instagram: string;
  privacyConsent: true;
  marketingConsent: boolean;
  guestLimit: number | null;
  createdAt: string;
  /** A full code puts the guest on its waitlist (their own request) instead of turning them away. */
  waitlist?: boolean;
}

export type AtomicAccessRequestResult =
  | { status: 'created' }
  | { status: 'duplicate' }
  | { status: 'waitlisted' }
  | { status: 'guest_limit_reached' };

interface RejectionStateRow {
  is_duplicate: number | boolean;
  guest_count: number;
  is_waitlisted?: number | boolean;
}

function parseRejectionState(row: unknown): RejectionStateRow | null {
  if (
    !isJsonObject(row)
    || (row.is_duplicate !== true
      && row.is_duplicate !== false
      && row.is_duplicate !== 0
      && row.is_duplicate !== 1)
    || typeof row.guest_count !== 'number'
    || !Number.isSafeInteger(row.guest_count)
    || row.guest_count < 0
  ) {
    return null;
  }

  return { is_duplicate: row.is_duplicate, guest_count: row.guest_count, is_waitlisted: row.is_waitlisted === true || row.is_waitlisted === 1 };
}

export function classifyRejectedAccessRequest(
  row: RejectionStateRow | null,
  guestLimit: number | null,
  waitlist = false,
): Exclude<AtomicAccessRequestResult['status'], 'created'> {
  if (row && (row.is_duplicate === true || row.is_duplicate === 1)) return 'duplicate';
  // Just put there by this batch, or by an earlier try: either way the guest is waiting.
  if (waitlist && row && (row.is_waitlisted === true || row.is_waitlisted === 1)) return 'waitlisted';
  if (guestLimit !== null && row && row.guest_count >= guestLimit) return 'guest_limit_reached';
  throw new Error('Conditional access request insert was rejected without a matching constraint');
}

/** The duplicate key SAME_GUEST compares stored ids against. */
export function instagramKey(instagram: string): string {
  return instagram.trim().replace(/^@+/, '').toLowerCase();
}

function getChanges(result: D1Result<unknown> | undefined): number {
  const changes = result?.meta.changes;
  return typeof changes === 'number' ? changes : 0;
}

/**
 * The capacity check, access request insert, optional Signal insert, and (for a guest's own
 * request) the waitlist fallback share one D1 batch. Existing unique indexes remain the final
 * idempotency boundary.
 */
export async function createAccessRequestAtomically(
  database: Pick<D1Database, 'prepare' | 'batch'>,
  input: AtomicAccessRequestInput,
): Promise<AtomicAccessRequestResult> {
  const accessRequestStatement = database.prepare(ACCESS_REQUEST_INSERT_SQL).bind(
    input.id,
    input.eventId,
    input.artistId,
    input.invitedBy,
    input.name,
    input.email,
    input.instagram,
    input.privacyConsent ? 1 : 0,
    input.marketingConsent ? 1 : 0,
    input.createdAt,
    input.eventId,
    instagramKey(input.instagram),
    input.email,
    input.guestLimit,
    input.eventId,
    input.artistId,
    input.guestLimit,
  );
  const marketingStatement = prepareGateSignalSubscriptionInsert(database, {
    id: input.signalId,
    accessRequestId: input.id,
    name: input.name,
    email: input.email ?? '',
    instagram: input.instagram,
    // The request parser only lets consent through with an email; this keeps Signal's NOT NULL safe.
    marketingConsent: input.marketingConsent && input.email !== null,
    createdAt: input.createdAt,
  });
  const key = instagramKey(input.instagram);
  const clearStatement = database.prepare(WAITLIST_CLEAR_SQL).bind(input.eventId, key, input.id);
  const waitlist = input.waitlist === true && input.guestLimit !== null;
  // Waiting needs no email: the artist reaches the guest by Instagram, and no news is sent.
  const waitlistStatement = waitlist
    ? [database.prepare(WAITLIST_INSERT_SQL).bind(
      input.id,
      input.eventId,
      input.artistId,
      input.invitedBy,
      input.name,
      input.instagram,
      input.privacyConsent ? 1 : 0,
      input.createdAt,
      input.eventId,
      key,
      input.email,
      input.eventId,
      key,
      input.eventId,
      input.artistId,
      input.guestLimit,
    )]
    : [];
  const rejectionStateStatement = database.prepare(REJECTION_STATE_SQL).bind(
    input.eventId,
    key,
    input.email,
    input.eventId,
    input.artistId,
    input.eventId,
    key,
  );
  const results = await database.batch([
    accessRequestStatement,
    marketingStatement,
    clearStatement,
    ...waitlistStatement,
    rejectionStateStatement,
  ]);
  const [accessRequestResult] = results;
  const rejectionStateResult = results[results.length - 1];

  if (getChanges(accessRequestResult) === 1) return { status: 'created' };
  return {
    status: classifyRejectedAccessRequest(
      parseRejectionState(rejectionStateResult?.results[0]),
      input.guestLimit,
      waitlist,
    ),
  };
}

/**
 * The artist moves a waiting guest onto their list: under the same id, only while the guest is on
 * this artist's waitlist and the list has room. The waitlist row goes once the guest is listed
 * (by this move or any earlier one), so a repeat click finds nothing left to move.
 */
const WAITLIST_PROMOTE_SQL = `
  INSERT INTO access_requests (
    id,
    event_id,
    artist_id,
    invited_by,
    name,
    email,
    instagram,
    privacy_consent,
    marketing_consent,
    created_at
  )
  SELECT w.id, w.event_id, w.artist_id, w.invited_by, w.name, NULL, w.instagram, w.privacy_consent, 0, ?
  FROM access_waitlist w
  WHERE w.id = ? AND w.event_id = ? AND w.artist_id = ?
    AND NOT EXISTS (
      SELECT 1
      FROM access_requests r
      WHERE r.event_id = w.event_id
        AND lower(ltrim(r.instagram, '@')) = lower(ltrim(w.instagram, '@'))
    )
    AND (
      SELECT COUNT(*)
      FROM access_requests
      WHERE event_id = ? AND artist_id = ?
    ) < ?
  ON CONFLICT DO NOTHING
`;

const WAITLIST_SETTLE_SQL = `
  DELETE FROM access_waitlist
  WHERE id = ? AND event_id = ? AND artist_id = ?
    AND EXISTS (
      SELECT 1
      FROM access_requests r
      WHERE r.event_id = access_waitlist.event_id
        AND lower(ltrim(r.instagram, '@')) = lower(ltrim(access_waitlist.instagram, '@'))
    )
`;

const WAITLIST_ROW_SQL = `
  SELECT
    EXISTS (
      SELECT 1
      FROM access_waitlist
      WHERE id = ? AND event_id = ? AND artist_id = ?
    ) AS waiting,
    (
      SELECT COUNT(*)
      FROM access_requests
      WHERE event_id = ? AND artist_id = ?
    ) AS guest_count
`;

export type WaitlistPromotionResult = 'promoted' | 'already_listed' | 'not_found' | 'guest_limit_reached';

export async function promoteWaitlistedGuest(
  database: Pick<D1Database, 'prepare' | 'batch'>,
  input: { id: string; eventId: string; artistId: string; guestLimit: number; promotedAt: string },
): Promise<WaitlistPromotionResult> {
  const { id, eventId, artistId, guestLimit } = input;
  // Read before the move, so a guest already listed elsewhere is told apart from a missing one.
  const [before, promoted, settled] = await database.batch([
    database.prepare(WAITLIST_ROW_SQL).bind(id, eventId, artistId, eventId, artistId),
    database.prepare(WAITLIST_PROMOTE_SQL).bind(input.promotedAt, id, eventId, artistId, eventId, artistId, guestLimit),
    database.prepare(WAITLIST_SETTLE_SQL).bind(id, eventId, artistId),
  ]);
  if (getChanges(promoted) === 1) return 'promoted';
  const row = before?.results[0] as { waiting?: number | boolean; guest_count?: number } | undefined;
  if (!row || !(row.waiting === 1 || row.waiting === true)) return 'not_found';
  if (getChanges(settled) === 1) return 'already_listed';
  return 'guest_limit_reached';
}
