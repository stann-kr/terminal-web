import { describe, expect, it } from 'vitest';
import {
  GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL,
  SIGNAL_SUBSCRIPTION_INSERT_SQL,
  insertSignalSubscription,
  prepareGateSignalSubscriptionInsert,
} from '../lib/signal/d1SignalSubscriptionRepository';
import { validateSignalSubscriptionInput } from '../lib/signal/subscriptionPolicy';

describe('Signal subscription input policy', () => {
  const valid = { name: '  Guest Name  ', instagram: '  @guest.name  ', consent: true };

  it('takes a name and an Instagram id; an email only when one is left', () => {
    expect(validateSignalSubscriptionInput(valid)).toEqual({
      ok: true,
      input: { name: 'Guest Name', email: null, instagram: '@guest.name', consent: true },
      fieldErrors: {},
    });
    const withEmail = validateSignalSubscriptionInput({ ...valid, email: '  GUEST@EXAMPLE.COM  ' });
    expect(withEmail.ok && withEmail.input.email).toBe('guest@example.com');
    const blankEmail = validateSignalSubscriptionInput({ ...valid, email: '  ' });
    expect(blankEmail.ok && blankEmail.input.email).toBeNull();
  });

  it('stores an Instagram id lowercase with its @, typed with or without one', () => {
    for (const typed of ['Guest.Name', '@Guest.Name']) {
      const result = validateSignalSubscriptionInput({ ...valid, instagram: typed });
      expect(result.ok && result.input.instagram).toBe('@guest.name');
    }
  });

  it.each([
    ['unknown key', { ...valid, role: 'admin' }],
    ['string consent', { ...valid, consent: 'true' }],
    ['numeric Instagram handle', { ...valid, instagram: 123 }],
    ['numeric email', { ...valid, email: 123 }],
    ['missing name', { instagram: '@guest', consent: true }],
  ])('rejects structurally invalid input: %s', (_label, input) => {
    expect(validateSignalSubscriptionInput(input)).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: {},
    });
  });

  it('requires a name and an Instagram id', () => {
    expect(validateSignalSubscriptionInput({ ...valid, name: ' ' })).toMatchObject({
      ok: false,
      error: 'ALL_FIELDS_REQUIRED',
      fieldErrors: { name: 'ALL_FIELDS_REQUIRED' },
    });
    expect(validateSignalSubscriptionInput({ ...valid, instagram: '', email: 'guest@example.com' })).toMatchObject({
      ok: false,
      error: 'ALL_FIELDS_REQUIRED',
      fieldErrors: { instagram: 'ALL_FIELDS_REQUIRED' },
    });
  });

  it('returns field-level errors while preserving the public API error priority', () => {
    expect(validateSignalSubscriptionInput({
      name: 'Guest',
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
  });

  it('applies the same public field bounds before any I/O', () => {
    expect(validateSignalSubscriptionInput({
      name: 'Guest',
      email: `${'a'.repeat(250)}@x.io`,
      instagram: `@${'a'.repeat(31)}`,
      consent: true,
    })).toMatchObject({
      ok: false,
      error: 'INVALID_INSTAGRAM_FORMAT',
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

  it('skips a subscriber already on the list by Instagram id or email', async () => {
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
        'guest',
      ],
    });
    expect(SIGNAL_SUBSCRIPTION_INSERT_SQL).toMatch(/WHERE NOT EXISTS[\s\S]*lower\(ltrim\(instagram, '@'\)\) = \?/);
    expect(SIGNAL_SUBSCRIPTION_INSERT_SQL).toContain('ON CONFLICT DO NOTHING');
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
