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
