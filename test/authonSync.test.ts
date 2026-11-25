import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccessRequestAtomically, promoteWaitlistedGuest } from '../lib/gate/d1AccessRequestRepository';
import { syncAccessRequestToAuthon } from '../lib/authon/syncGuest';
import { AUTHON_SYNC_ROW_SQL, buildAuthonGuestPayload, classifyAuthonReply } from '../lib/authon/syncPayload.mjs';
import { d1, migratedSqlite, sqliteAvailable, type SqliteDatabase } from './sqliteD1';

const EVENT = JSON.stringify({ date: '2026-11-28', time: '22:00' });
const ARTIST = JSON.stringify({ name: 'HOGUN', guestCode: '3J5W', guestLimit: 10 });

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    name: ' Guest One ',
    email: 'guest@example.com',
    instagram: 'guest.one',
    invitedBy: 'HOGUN',
    createdAt: '2026-11-26T03:00:00.000Z',
    eventData: EVENT,
    artistData: ARTIST,
    ...overrides,
  };
}

describe('authon guest payload', () => {
  it('carries the guest, the event date, and the inviting artist with its limit', () => {
    expect(buildAuthonGuestPayload(row())).toEqual({
      terminalRequestId: 'req_1',
      name: 'Guest One',
      email: 'guest@example.com',
      instagram: 'guest.one',
      date: '2026-11-28',
      createdAt: '2026-11-26T03:00:00.000Z',
      artistName: 'HOGUN',
      guestLimit: 10,
    });
  });

  it('sends empty optional fields as null, since authon refuses empty text', () => {
    const payload = buildAuthonGuestPayload(row({ email: null, instagram: '', artistData: null }));
    expect(payload).toMatchObject({ email: null, instagram: null, artistName: 'HOGUN', guestLimit: null });
  });

  it('falls back to the artist record name, and drops a limit authon would refuse', () => {
    expect(buildAuthonGuestPayload(row({ invitedBy: null }))?.artistName).toBe('HOGUN');
    expect(buildAuthonGuestPayload(row({ artistData: JSON.stringify({ name: 'X', guestLimit: 0 }) }))?.guestLimit).toBeNull();
    expect(buildAuthonGuestPayload(row({ artistData: '{broken' }))?.guestLimit).toBeNull();
  });

  it('makes nothing without a name or a calendar date', () => {
    expect(buildAuthonGuestPayload(row({ name: '  ' }))).toBeNull();
    expect(buildAuthonGuestPayload(row({ eventData: JSON.stringify({ date: '11.28' }) }))).toBeNull();
    expect(buildAuthonGuestPayload(row({ eventData: 'not json' }))).toBeNull();
  });

  it('reads authon replies as done, retry later, or refused', () => {
    expect(classifyAuthonReply(200, { ok: true, guestId: 'g' })).toBe('synced');
    expect(classifyAuthonReply(503, { ok: false, error: 'EVENT_NOT_READY' })).toBe('retry');
    expect(classifyAuthonReply(500, null)).toBe('retry');
    expect(classifyAuthonReply(409, { ok: false })).toBe('rejected');
    expect(classifyAuthonReply(401, { ok: false })).toBe('rejected');
  });
});

describe('syncAccessRequestToAuthon', () => {
  const first = vi.fn();
  const fetch = vi.fn();
  const DB = { prepare: () => ({ bind: () => ({ first }) }) } as unknown as D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    first.mockResolvedValue(row());
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, guestId: 'g' }), { status: 200 }));
  });

  it('does nothing without the binding or the secret (local and development)', async () => {
    expect(await syncAccessRequestToAuthon({ DB, AUTHON: undefined, AUTHON_SYNC_SECRET: 's' }, 'req_1')).toBe('disabled');
    expect(await syncAccessRequestToAuthon({ DB, AUTHON: { fetch } as unknown as Fetcher, AUTHON_SYNC_SECRET: undefined }, 'req_1')).toBe('disabled');
    expect(first).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts the payload with the shared secret through the binding', async () => {
    const env = { DB, AUTHON: { fetch } as unknown as Fetcher, AUTHON_SYNC_SECRET: 'shared' };
    expect(await syncAccessRequestToAuthon(env, 'req_1')).toBe('synced');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://authon/api/internal/sync-guest');
    expect(init.headers['x-internal-secret']).toBe('shared');
    expect(JSON.parse(init.body)).toEqual(buildAuthonGuestPayload(row()));
  });

  it('reports a missing request, an unusable row and a retryable reply without throwing', async () => {
    const env = { DB, AUTHON: { fetch } as unknown as Fetcher, AUTHON_SYNC_SECRET: 'shared' };
    first.mockResolvedValueOnce(null);
    expect(await syncAccessRequestToAuthon(env, 'req_x')).toBe('not_found');
    first.mockResolvedValueOnce(row({ eventData: '{}' }));
    expect(await syncAccessRequestToAuthon(env, 'req_1')).toBe('invalid');
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'EVENT_NOT_READY' }), { status: 503 }));
    expect(await syncAccessRequestToAuthon(env, 'req_1')).toBe('retry');
  });
});

describe.skipIf(!sqliteAvailable)('authon sync row SQL (SQLite with every migration)', () => {
  let sqlite: SqliteDatabase;
  let db: Pick<D1Database, 'prepare' | 'batch'>;

  beforeEach(() => {
    sqlite = migratedSqlite();
    sqlite.exec(`INSERT INTO events (id, data) VALUES ('TRM-03', '${EVENT}')`);
    sqlite.exec(`INSERT INTO artists (id, event_id, data) VALUES ('03-B', 'TRM-03', '${ARTIST}')`);
    db = d1(sqlite);
  });

  it('reads a listed request and a promoted waitlist entry into payloads', async () => {
    const base = {
      signalId: 'sig-1', eventId: 'TRM-03', artistId: '03-B', invitedBy: 'HOGUN', email: null,
      marketingConsent: false, guestLimit: 1, waitlist: true,
    };
    expect(await createAccessRequestAtomically(db, { ...base, id: 'req-1', name: 'One', instagram: '@one', createdAt: '2026-11-26T00:00:01.000Z' }))
      .toEqual({ status: 'created' });
    expect(await createAccessRequestAtomically(db, { ...base, id: 'req-2', signalId: 'sig-2', name: 'Two', instagram: '@two', createdAt: '2026-11-26T00:00:02.000Z' }))
      .toEqual({ status: 'waitlisted' });

    const read = (id: string) => sqlite.prepare(AUTHON_SYNC_ROW_SQL).all(id)[0] as Parameters<typeof buildAuthonGuestPayload>[0];
    expect(buildAuthonGuestPayload(read('req-1'))).toMatchObject({
      terminalRequestId: 'req-1', name: 'One', instagram: '@one', date: '2026-11-28', artistName: 'HOGUN', guestLimit: 10,
    });
    // A waitlisted guest is not a request until moved up, and then keeps its waitlist id.
    expect(sqlite.prepare(AUTHON_SYNC_ROW_SQL).all('req-2')[0]).toBeUndefined();
    const waitId = (sqlite.prepare('SELECT id FROM access_waitlist').all()[0] as { id: string }).id;
    expect(await promoteWaitlistedGuest(db, { id: waitId, eventId: 'TRM-03', artistId: '03-B', guestLimit: 2, promotedAt: '2026-11-26T01:00:00.000Z' }))
      .toBe('promoted');
    expect(buildAuthonGuestPayload(read(waitId))).toMatchObject({ name: 'Two', email: null, artistName: 'HOGUN' });
  });
});
