export interface StoredSignalSubscription {
  id: string;
  name: string | null;
  email: string;
  instagram: string;
  source: 'signal' | 'gate';
  createdAt: string;
}

export interface GateSignalSubscriptionInput {
  id: string;
  accessRequestId: string;
  name: string;
  email: string;
  instagram: string;
  marketingConsent: boolean;
  createdAt: string;
}

export type SignalSubscriptionInsertResult =
  | { status: 'created' }
  | { status: 'duplicate' };

export const SIGNAL_SUBSCRIPTION_INSERT_SQL = `
  INSERT INTO signal (
    id,
    name,
    email,
    instagram,
    source,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO NOTHING
`;

export const GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL = `
  INSERT INTO signal (
    id,
    name,
    email,
    instagram,
    source,
    created_at
  )
  SELECT ?, ?, ?, ?, 'gate', ?
  WHERE ? = 1
    AND EXISTS (
      SELECT 1
      FROM access_requests
      WHERE id = ?
    )
  ON CONFLICT(email) DO NOTHING
`;

export function prepareSignalSubscriptionInsert(
  database: Pick<D1Database, 'prepare'>,
  subscription: StoredSignalSubscription,
) {
  return database.prepare(SIGNAL_SUBSCRIPTION_INSERT_SQL).bind(
    subscription.id,
    subscription.name,
    subscription.email,
    subscription.instagram,
    subscription.source,
    subscription.createdAt,
  );
}

export function prepareGateSignalSubscriptionInsert(
  database: Pick<D1Database, 'prepare'>,
  input: GateSignalSubscriptionInput,
) {
  return database.prepare(GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL).bind(
    input.id,
    input.name,
    input.email,
    input.instagram,
    input.createdAt,
    input.marketingConsent ? 1 : 0,
    input.accessRequestId,
  );
}

/** Inserts through the unique email boundary without exposing duplicate state publicly. */
export async function insertSignalSubscription(
  database: Pick<D1Database, 'prepare'>,
  subscription: StoredSignalSubscription,
): Promise<SignalSubscriptionInsertResult> {
  const result = await prepareSignalSubscriptionInsert(database, subscription).run();
  return result.meta.changes === 1 ? { status: 'created' } : { status: 'duplicate' };
}

/**
 * A gate request keeps its email only to send news, "until unsubscribe" as its consent says. So
 * unsubscribing forgets that copy too, before the subscription that names the email is gone. Both
 * sides are compared without capitals or outer spaces: rows are written that way now, but an
 * older subscription may not be.
 */
const FORGET_GATE_EMAIL_SQL = `
  UPDATE access_requests
  SET email = NULL, marketing_consent = 0
  WHERE lower(trim(email)) = (SELECT lower(trim(email)) FROM signal WHERE id = ?)
`;

const SIGNAL_SUBSCRIPTION_DELETE_SQL = `DELETE FROM signal WHERE id = ?`;

/** One batch, so the email is never left behind on a request; a repeat finds nothing and still succeeds. */
export async function removeSignalSubscription(
  database: Pick<D1Database, 'prepare' | 'batch'>,
  id: string,
): Promise<void> {
  await database.batch([
    database.prepare(FORGET_GATE_EMAIL_SQL).bind(id),
    database.prepare(SIGNAL_SUBSCRIPTION_DELETE_SQL).bind(id),
  ]);
}
