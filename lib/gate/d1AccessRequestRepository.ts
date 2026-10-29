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
    ) AS guest_count
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
}

export type AtomicAccessRequestResult =
  | { status: 'created' }
  | { status: 'duplicate' }
  | { status: 'guest_limit_reached' };

interface RejectionStateRow {
  is_duplicate: number | boolean;
  guest_count: number;
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

  return { is_duplicate: row.is_duplicate, guest_count: row.guest_count };
}

export function classifyRejectedAccessRequest(
  row: RejectionStateRow | null,
  guestLimit: number | null,
): Exclude<AtomicAccessRequestResult['status'], 'created'> {
  if (row && (row.is_duplicate === true || row.is_duplicate === 1)) return 'duplicate';
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
 * The capacity check, access request insert, and optional Signal insert share
 * one D1 batch. Existing unique indexes remain the final idempotency boundary.
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
  const rejectionStateStatement = database.prepare(REJECTION_STATE_SQL).bind(
    input.eventId,
    instagramKey(input.instagram),
    input.email,
    input.eventId,
    input.artistId,
  );
  const [accessRequestResult, , rejectionStateResult] = await database.batch([
    accessRequestStatement,
    marketingStatement,
    rejectionStateStatement,
  ]);

  if (getChanges(accessRequestResult) === 1) return { status: 'created' };
  return {
    status: classifyRejectedAccessRequest(
      parseRejectionState(rejectionStateResult?.results[0]),
      input.guestLimit,
    ),
  };
}
