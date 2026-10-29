import { describe, expect, it } from 'vitest';
import {
  GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL,
  SIGNAL_SUBSCRIPTION_INSERT_SQL,
  insertSignalSubscription,
  prepareGateSignalSubscriptionInsert,
} from '../lib/signal/d1SignalSubscriptionRepository';
import { validateSignalSubscriptionInput } from '../lib/signal/subscriptionPolicy';

describe('Signal subscription input policy', () => {
  it('normalizes one valid payload for client and server consumers', () => {
    expect(validateSignalSubscriptionInput({
      email: '  GUEST@EXAMPLE.COM  ',
      instagram: '  @guest.name  ',
      consent: true,
    })).toEqual({
      ok: true,
      input: {
        email: 'guest@example.com',
        instagram: '@guest.name',
        consent: true,
      },
      fieldErrors: {},
    });
  });

  it.each([
    ['unknown key', { email: 'guest@example.com', instagram: '@guest', consent: true, role: 'admin' }],
    ['string consent', { email: 'guest@example.com', instagram: '@guest', consent: 'true' }],
    ['numeric Instagram handle', { email: 'guest@example.com', instagram: 123, consent: true }],
  ])('rejects structurally invalid input: %s', (_label, input) => {
    expect(validateSignalSubscriptionInput(input)).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: {},
    });
  });

  it('returns field-level errors while preserving the public API error priority', () => {
    expect(validateSignalSubscriptionInput({
      email: 'invalid',
      instagram: '@@invalid',
      consent: false,
    })).toEqual({
      ok: false,
      error: 'CONSENT_REQUIRED',
      fieldErrors: {
        email: 'INVALID_EMAIL_FORMAT',
        instagram: 'INVALID_INSTAGRAM_FORMAT',
        consent: 'CONSENT_REQUIRED',
      },
    });

    expect(validateSignalSubscriptionInput({ email: '', instagram: '', consent: false })).toMatchObject({
      ok: false,
      error: 'ALL_FIELDS_REQUIRED',
    });
  });

  it('takes an email alone; the Instagram handle is optional', () => {
    expect(validateSignalSubscriptionInput({ email: 'Guest@Example.com', instagram: '  ', consent: true })).toEqual({
      ok: true,
      input: { email: 'guest@example.com', instagram: '', consent: true },
      fieldErrors: {},
    });
    expect(validateSignalSubscriptionInput({ email: '', instagram: '@guest', consent: true })).toMatchObject({
      ok: false,
      error: 'ALL_FIELDS_REQUIRED',
      fieldErrors: { email: 'ALL_FIELDS_REQUIRED' },
    });
  });

  it('applies the same public field bounds before any I/O', () => {
    expect(validateSignalSubscriptionInput({
      email: `${'a'.repeat(250)}@x.io`,
      instagram: `@${'a'.repeat(31)}`,
      consent: true,
    })).toMatchObject({
      ok: false,
      error: 'INVALID_EMAIL_FORMAT',
      fieldErrors: {
        email: 'INVALID_EMAIL_FORMAT',
        instagram: 'INVALID_INSTAGRAM_FORMAT',
      },
    });
  });
});

describe('Signal D1 statement contract', () => {
  function createDatabaseStub(changes: number) {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const database = {
      prepare(sql: string) {
        const entry = { sql, values: [] as unknown[] };
        prepared.push(entry);
        const statement = {
          bind(...values: unknown[]) {
            entry.values = values;
            return statement;
          },
          async run() {
            return { success: true, meta: { changes }, results: [] };
          },
        };
        return statement;
      },
    } as unknown as Pick<D1Database, 'prepare'>;
    return { database, prepared };
  }

  const subscription = {
    id: 'sig-1',
    name: null,
    email: 'guest@example.com',
    instagram: '@guest',
    source: 'signal' as const,
    createdAt: '2026-08-23T00:00:00.000Z',
  };

  it('uses the unique email index as the duplicate boundary', async () => {
    const created = createDatabaseStub(1);
    const duplicate = createDatabaseStub(0);

    await expect(insertSignalSubscription(created.database, subscription)).resolves.toEqual({
      status: 'created',
    });
    await expect(insertSignalSubscription(duplicate.database, subscription)).resolves.toEqual({
      status: 'duplicate',
    });
    expect(created.prepared[0]).toEqual({
      sql: SIGNAL_SUBSCRIPTION_INSERT_SQL,
      values: [
        subscription.id,
        subscription.name,
        subscription.email,
        subscription.instagram,
        subscription.source,
        subscription.createdAt,
      ],
    });
    expect(SIGNAL_SUBSCRIPTION_INSERT_SQL).toContain('ON CONFLICT(email) DO NOTHING');
  });

  it('prepares the Gate marketing insert without executing outside its D1 batch', () => {
    const { database, prepared } = createDatabaseStub(0);
    const statement = prepareGateSignalSubscriptionInsert(database, {
      id: 'sig-1',
      accessRequestId: 'req-1',
      name: 'Guest Name',
      email: 'guest@example.com',
      instagram: '@guest',
      marketingConsent: true,
      createdAt: '2026-08-23T00:00:00.000Z',
    });

    expect(statement).toBeDefined();
    expect(prepared).toEqual([{
      sql: GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL,
      values: [
        'sig-1',
        'Guest Name',
        'guest@example.com',
        '@guest',
        '2026-08-23T00:00:00.000Z',
        1,
        'req-1',
      ],
    }]);
  });
});
