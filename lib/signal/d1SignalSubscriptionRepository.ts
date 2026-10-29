export interface StoredSignalSubscription {
  id: string;
  name: string | null;
  email: string | null;
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

/** One subscriber per Instagram id (case and a leading @ aside), and per email when one is left. */
export const SIGNAL_SUBSCRIPTION_INSERT_SQL = `
  INSERT INTO signal (
    id,
    name,
    email,
    instagram,
    source,
    created_at
  )
  SELECT ?, ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM signal
    WHERE instagram <> '' AND lower(ltrim(instagram, '@')) = ?
  )
  ON CONFLICT DO NOTHING
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
    subscription.instagram.trim().replace(/^@+/, '').toLowerCase(),
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
