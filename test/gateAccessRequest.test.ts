import { describe, expect, it } from 'vitest';
import {
  inspectArtistAccessData,
  normalizeAccessCode,
  parseArtistAccessData,
  parseGateRequestBody,
  parseUpcomingEventCandidate,
  findUpcomingGateEvent,
  isGateRequestWindowActive,
  hasConfiguredAccessCode,
  resolveArtistAccessCode,
} from '../lib/gate/createAccessRequest';
import {
  ACCESS_REQUEST_INSERT_SQL,
  classifyRejectedAccessRequest,
  createAccessRequestAtomically,
  instagramKey,
} from '../lib/gate/d1AccessRequestRepository';
import { GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL } from '../lib/signal/d1SignalSubscriptionRepository';

const validBody = {
  eventId: 'event-1',
  accessCode: '  ARTIST-01  ',
  invitedBy: '  spoofed name  ',
  name: '  Guest Name  ',
  email: '  GUEST@EXAMPLE.COM  ',
  instagram: '@guest.name',
  privacyConsent: true,
  marketingConsent: false,
};

describe('gate request runtime validation', () => {
  it('normalizes a valid payload without coercing values', () => {
    expect(parseGateRequestBody(validBody)).toEqual({
      ok: true,
      input: {
        eventId: 'event-1',
        accessCode: 'ARTIST-01',
        name: 'Guest Name',
        email: null,
        instagram: '@guest.name',
        privacyConsent: true,
        marketingConsent: false,
      },
    });
  });

  it('stores an Instagram id lowercase with its @, typed with or without one', () => {
    for (const typed of ['Guest.Name', '@Guest.Name']) {
      const result = parseGateRequestBody({ ...validBody, instagram: typed });
      expect(result.ok && result.input.instagram).toBe('@guest.name');
    }
  });

  it('keeps an email only for a guest who asked for news', () => {
    const result = parseGateRequestBody({ ...validBody, marketingConsent: true });
    expect(result.ok && result.input.email).toBe('guest@example.com');
  });

  it('needs no email from a guest who did not ask for news', () => {
    const { email: _email, ...body } = validBody;
    const result = parseGateRequestBody(body);
    expect(result.ok && result.input.email).toBeNull();
  });

  it('asks for an email, and a well-formed one, once news is ticked', () => {
    const { email: _email, ...body } = validBody;
    expect(parseGateRequestBody({ ...body, marketingConsent: true })).toEqual({
      ok: false,
      error: 'EMAIL_REQUIRED_FOR_NEWS',
    });
    expect(parseGateRequestBody({ ...validBody, email: '  ', marketingConsent: true })).toEqual({
      ok: false,
      error: 'EMAIL_REQUIRED_FOR_NEWS',
    });
    expect(parseGateRequestBody({ ...validBody, email: 'nope', marketingConsent: true })).toEqual({
      ok: false,
      error: 'INVALID_EMAIL_FORMAT',
    });
  });

  it.each([
    ['string privacy consent', { ...validBody, privacyConsent: 'true' }],
    ['string false marketing consent', { ...validBody, marketingConsent: 'false' }],
    ['numeric email', { ...validBody, email: 123 }],
    ['object access code', { ...validBody, accessCode: { value: 'ARTIST-01' } }],
    ['invalid event id', { ...validBody, eventId: 1 }],
    ['oversized event id', { ...validBody, eventId: 'x'.repeat(129) }],
    ['unknown key', { ...validBody, role: 'admin' }],
  ])('rejects %s before database access', (_label, body) => {
    expect(parseGateRequestBody(body)).toEqual({ ok: false, error: 'INVALID_INPUT' });
  });

  it('requires the event id from older clients explicitly', () => {
    const { eventId: _eventId, ...body } = validBody;
    expect(parseGateRequestBody(body)).toEqual({ ok: false, error: 'EVENT_ID_REQUIRED' });
  });

  it('does not treat a false privacy boolean as consent', () => {
    expect(parseGateRequestBody({ ...validBody, privacyConsent: false })).toEqual({
      ok: false,
      error: 'PRIVACY_CONSENT_REQUIRED',
    });
  });

  it('defaults omitted optional marketing consent to false', () => {
    const { marketingConsent: _marketingConsent, ...body } = validBody;
    const result = parseGateRequestBody(body);

    expect(result.ok && result.input.marketingConsent).toBe(false);
  });
});

describe('artist access data validation', () => {
  it('uses one trim and case-folding contract for all access-code checks', () => {
    expect(normalizeAccessCode('  Artist-Code-01  ')).toBe('ARTIST-CODE-01');
  });

  it('accepts a bounded integer capacity and trims server-owned inviter data', () => {
    expect(parseArtistAccessData(JSON.stringify({
      guestCode: ' CODE-1 ',
      guestLimit: 25,
      name: ' Artist Name ',
    }))).toEqual({ guestCode: 'CODE-1', guestLimit: 25, name: 'Artist Name' });
  });

  it('distinguishes missing access configuration from malformed configured data', () => {
    expect(inspectArtistAccessData(JSON.stringify({ name: 'Public Artist' }))).toEqual({
      kind: 'unconfigured',
    });
    expect(inspectArtistAccessData(JSON.stringify({ guestCode: 'CODE', name: 'Artist' }))).toEqual({
      kind: 'invalid',
    });
  });

  it.each([
    '{',
    JSON.stringify({ guestCode: 123, guestLimit: 1 }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: '1' }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: -1 }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: 1.5 }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: 10_001 }),
    JSON.stringify({ guestCode: 'CODE', name: 'Artist' }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: 1 }),
    JSON.stringify({ guestCode: 'CODE', guestLimit: 1, name: '' }),
  ])('fails closed for malformed artist JSON: %s', (data) => {
    expect(parseArtistAccessData(data)).toBeNull();
  });

  it('fails closed for malformed or elapsed event lifecycle JSON', () => {
    const now = new Date('2026-08-11T12:00:00+09:00');

    expect(parseUpcomingEventCandidate('bad', '{', now)).toBeNull();
    expect(parseUpcomingEventCandidate(
      'elapsed',
      JSON.stringify({ date: '2026-08-10', time: '23:00 KST', status: 'UPCOMING' }),
      now,
    )).toBeNull();
    expect(parseUpcomingEventCandidate(
      'future',
      JSON.stringify({ date: '2026-08-12', time: '23:00 KST', status: 'UPCOMING' }),
      now,
    )?.rowId).toBe('future');
  });

  it('selects stored event lifecycle and request-window state through one Gate domain owner', () => {
    const now = new Date('2026-08-01T12:00:00+09:00');
    const event = findUpcomingGateEvent([
      { id: 'invalid', data: '{' },
      {
        id: 'later',
        data: JSON.stringify({ date: '2026-08-20', time: '23:00 KST', status: 'UPCOMING' }),
      },
      {
        id: 'next',
        data: JSON.stringify({ date: '2026-08-10', time: '23:00 KST', status: 'UPCOMING' }),
      },
    ], now);

    expect(event?.rowId).toBe('next');
    expect(event && isGateRequestWindowActive(event, now)).toBe(true);
  });

  it('opens an event earlier than the default window only by its own stored accessWindowDays', () => {
    const now = new Date('2026-10-16T12:00:00+09:00');
    const night = { date: '2026-11-28', time: '23:00 KST', status: 'UPCOMING' };
    const gate = (data: object) => findUpcomingGateEvent([{ id: 'TRM-03', data: JSON.stringify(data) }], now)!;
    expect(isGateRequestWindowActive(gate(night), now)).toBe(false);
    expect(isGateRequestWindowActive(gate({ ...night, accessWindowDays: 60 }), now)).toBe(true);
    // A malformed window falls back to the default instead of opening the gate.
    for (const accessWindowDays of [0, 1.5, '60', 10_000]) {
      expect(isGateRequestWindowActive(gate({ ...night, accessWindowDays }), now)).toBe(false);
    }
  });

  it('uses one access-code resolution for Gate request and code-info consumers', () => {
    expect(resolveArtistAccessCode([
      {
        id: 'artist-1',
        data: JSON.stringify({ guestCode: ' CODE-1 ', guestLimit: 5, name: ' Artist One ' }),
      },
    ], 'code-1')).toEqual({
      kind: 'match',
      artistId: 'artist-1',
      data: { guestCode: 'CODE-1', guestLimit: 5, name: 'Artist One' },
    });
    expect(resolveArtistAccessCode([
      { id: 'artist-1', data: JSON.stringify({ guestCode: 'CODE-1', name: 'Broken' }) },
    ], 'code-1')).toEqual({ kind: 'unavailable' });
  });

  it('closes an event none of whose artist rows carries a guest code, apart from a wrong code', () => {
    const lineupOnly = [
      { id: 'artist-1', data: JSON.stringify({ name: 'Artist One', status: 'CONFIRMED' }) },
    ];
    expect(hasConfiguredAccessCode(lineupOnly)).toBe(false);
    expect(hasConfiguredAccessCode([])).toBe(false);
    expect(resolveArtistAccessCode(lineupOnly, 'code-1')).toEqual({ kind: 'closed' });
    expect(resolveArtistAccessCode([], 'code-1')).toEqual({ kind: 'closed' });

    // A hidden host row (PENDING, not on the public lineup) with a code keeps the event open.
    const hostRow = {
      id: 'host-row',
      data: JSON.stringify({ name: 'HOST', status: 'PENDING', guestCode: 'HOST-CODE', guestLimit: 30 }),
    };
    expect(hasConfiguredAccessCode([...lineupOnly, hostRow])).toBe(true);
    expect(resolveArtistAccessCode([...lineupOnly, hostRow], 'host-code')).toMatchObject({ kind: 'match', artistId: 'host-row' });
    expect(resolveArtistAccessCode([...lineupOnly, hostRow], 'other')).toEqual({ kind: 'not_found' });
  });
});

describe('atomic access request statement contract', () => {
  const atomicInput = {
    id: 'req-1',
    signalId: 'sig-1',
    eventId: 'event-1',
    artistId: 'artist-1',
    invitedBy: 'Artist Name',
    name: 'Guest Name',
    email: 'guest@example.com',
    instagram: '@guest',
    privacyConsent: true as const,
    marketingConsent: true,
    guestLimit: 25,
    createdAt: '2026-08-11T00:00:00.000Z',
  };

  function createDatabaseStub(
    changes: number,
    rejectionState: { is_duplicate: number; guest_count: number } | null = null,
  ) {
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
        };
        return statement;
      },
      async batch(statements: unknown[]) {
        expect(statements).toHaveLength(3);
        return [
          { success: true, meta: { changes }, results: [] },
          { success: true, meta: { changes: 0 }, results: [] },
          {
            success: true,
            meta: { changes: 0 },
            results: rejectionState ? [rejectionState] : [],
          },
        ];
      },
    } as unknown as Pick<D1Database, 'prepare' | 'batch'>;

    return { database, prepared };
  }

  it('checks a duplicate guest and capacity inside the request insert statement', () => {
    expect(ACCESS_REQUEST_INSERT_SQL).toMatch(
      /WHERE NOT EXISTS[\s\S]*event_id = \? AND \([\s\S]*lower\(ltrim\(instagram, '@'\)\) = \?[\s\S]*OR \(email IS NOT NULL AND email = \?\)/,
    );
    expect(ACCESS_REQUEST_INSERT_SQL).toMatch(/SELECT COUNT\(\*\)[\s\S]*event_id = \? AND artist_id = \?/);
    expect(ACCESS_REQUEST_INSERT_SQL).toContain('ON CONFLICT DO NOTHING');
  });

  it('folds case and a leading @ into the Instagram duplicate key', () => {
    expect(instagramKey(' @Guest.Name ')).toBe('guest.name');
    expect(instagramKey('guest.name')).toBe('guest.name');
  });

  it('stores no email and subscribes nobody for a guest without one', async () => {
    const { database, prepared } = createDatabaseStub(1);
    await createAccessRequestAtomically(database, {
      ...atomicInput,
      email: null,
      marketingConsent: false,
    });
    expect(prepared[0].values[5]).toBeNull();
    expect(prepared[1].values.at(-2)).toBe(0);
  });

  it('only inserts marketing after the request id exists and tolerates subscriber conflicts', () => {
    expect(GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL).toMatch(
      /EXISTS[\s\S]*FROM access_requests[\s\S]*WHERE id = \?/,
    );
    expect(GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL).toContain('ON CONFLICT(email) DO NOTHING');
  });

  it('classifies a duplicate guest before capacity', () => {
    expect(classifyRejectedAccessRequest({ is_duplicate: 1, guest_count: 25 }, 25)).toBe('duplicate');
  });

  it('classifies a full capacity when the guest is new', () => {
    expect(classifyRejectedAccessRequest({ is_duplicate: 0, guest_count: 25 }, 25)).toBe(
      'guest_limit_reached',
    );
  });

  it('raises an invariant error for an unexplained zero-change insert', () => {
    expect(() => classifyRejectedAccessRequest({ is_duplicate: 0, guest_count: 0 }, null)).toThrow(
      /without a matching constraint/,
    );
  });

  it('treats only the first batch result as access request creation', async () => {
    const { database, prepared } = createDatabaseStub(1);

    await expect(createAccessRequestAtomically(database, atomicInput)).resolves.toEqual({
      status: 'created',
    });
    expect(prepared).toHaveLength(3);
    expect(prepared[0].sql).toBe(ACCESS_REQUEST_INSERT_SQL);
    expect(prepared[1].sql).toBe(GATE_SIGNAL_SUBSCRIPTION_INSERT_SQL);
  });

  it('runs the follow-up classifier after a duplicate zero-change insert', async () => {
    const { database, prepared } = createDatabaseStub(0, { is_duplicate: 1, guest_count: 1 });

    await expect(createAccessRequestAtomically(database, atomicInput)).resolves.toEqual({
      status: 'duplicate',
    });
    expect(prepared).toHaveLength(3);
    expect(prepared[2].values).toEqual([
      atomicInput.eventId,
      'guest',
      atomicInput.email,
      atomicInput.eventId,
      atomicInput.artistId,
    ]);
  });

  it('runs the follow-up classifier after a capacity zero-change insert', async () => {
    const { database } = createDatabaseStub(0, { is_duplicate: 0, guest_count: 25 });

    await expect(createAccessRequestAtomically(database, atomicInput)).resolves.toEqual({
      status: 'guest_limit_reached',
    });
  });
});
