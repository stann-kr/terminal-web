import { generateId } from '../utils/id';
import {
  insertSignalSubscription,
  type SignalSubscriptionInsertResult,
} from './d1SignalSubscriptionRepository';
import type { SignalSubscriptionInput } from './subscriptionPolicy';

export function createSignalSubscription(
  database: Pick<D1Database, 'prepare'>,
  input: SignalSubscriptionInput,
  now: Date = new Date(),
  id: string = generateId('sig'),
): Promise<SignalSubscriptionInsertResult> {
  return insertSignalSubscription(database, {
    id,
    name: null,
    email: input.email,
    instagram: input.instagram,
    source: 'signal',
    createdAt: now.toISOString(),
  });
}
