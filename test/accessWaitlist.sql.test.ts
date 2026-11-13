import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAccessRequestAtomically,
  promoteWaitlistedGuest,
  type AtomicAccessRequestInput,
} from '../lib/gate/d1AccessRequestRepository';
import { d1, migratedSqlite, sqliteAvailable, type SqliteDatabase } from './sqliteD1';

/**
 * The waitlist SQL against a real SQLite built from every migration, so the batch order (insert,
 * clean-up, waitlist, state) and the conditions in each statement are exercised, not just their
 * text.
 */
describe.skipIf(!sqliteAvailable)('access waitlist SQL (SQLite with every migration)', () => {
  let sqlite: SqliteDatabase;
  let db: Pick<D1Database, 'prepare' | 'batch'>;
  let serial = 0;
  const count = (table: string, where = '1') => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).all()[0] as { n: number }).n;
  const request = (instagram: string, overrides: Partial<AtomicAccessRequestInput> = {}) => createAccessRequestAtomically(db, {
    id: `req-${++serial}`,
    signalId: `sig-${serial}`,
    eventId: 'TRM-03',
    artistId: '03-B',
    invitedBy: 'HOGUN',
    name: `Guest ${serial}`,
    email: null,
    instagram,
    privacyConsent: true,
    marketingConsent: false,
    guestLimit: 2,
    createdAt: `2026-11-12T00:00:${String(serial).padStart(2, '0')}.000Z`,
    waitlist: true,
    ...overrides,
  });

  beforeEach(() => {
    sqlite = migratedSqlite();
    sqlite.exec(`INSERT INTO events (id, data) VALUES ('TRM-03', '{}')`);
    sqlite.exec(`INSERT INTO artists (id, event_id, data) VALUES ('03-B', 'TRM-03', '{}'), ('03-HOST', 'TRM-03', '{}')`);
    db = d1(sqlite);
    serial = 0;
  });

  it('lists guests up to the limit, then waits the rest, once each', async () => {
    expect(await request('@one')).toEqual({ status: 'created' });
    expect(await request('@two')).toEqual({ status: 'created' });
    expect(await request('@three')).toEqual({ status: 'waitlisted' });
    // The same guest again (case and @ aside) still waits, only once, and is told it is not new.
    expect(await request('THREE')).toEqual({ status: 'already_waitlisted' });
    // So is the same guest coming with another inviter's full code: the first entry stands alone.
    expect(await request('@three', { artistId: '03-HOST', invitedBy: 'TERMINAL', guestLimit: 0 })).toEqual({ status: 'already_waitlisted' });
    expect(count('access_waitlist', "artist_id = '03-B'")).toBe(1);
    expect(await request('@one')).toEqual({ status: 'duplicate' });
    expect(count('access_requests')).toBe(2);
    expect(count('access_waitlist')).toBe(1);
  });

  it("keeps the artist's own entry off the waitlist", async () => {
    await request('@one');
    await request('@two');
    expect(await request('@three', { waitlist: false })).toEqual({ status: 'guest_limit_reached' });
    expect(count('access_waitlist')).toBe(0);
  });

  it('takes a waiting guest off the waitlist once they get in by another code', async () => {
    await request('@one');
    await request('@two');
    await request('@three');
    expect(await request('@three', { artistId: '03-HOST', invitedBy: 'TERMINAL', guestLimit: 10_000 })).toEqual({ status: 'created' });
    expect(count('access_waitlist')).toBe(0);
  });

  it('moves a waiting guest up only while there is room, and only once', async () => {
    await request('@one');
    await request('@two');
    await request('@three');
    const [waiting] = sqlite.prepare('SELECT id FROM access_waitlist').all() as { id: string }[];
    const promote = (guestLimit: number, artistId = '03-B') => promoteWaitlistedGuest(db, {
      id: waiting.id, eventId: 'TRM-03', artistId, guestLimit, promotedAt: '2026-11-12T01:00:00.000Z',
    });
    expect(await promote(2)).toBe('guest_limit_reached');
    expect(await promote(3, '03-HOST')).toBe('not_found');
    expect(await promote(3)).toBe('promoted');
    expect(count('access_requests', `id = '${waiting.id}' AND artist_id = '03-B' AND email IS NULL`)).toBe(1);
    expect(count('access_waitlist')).toBe(0);
    expect(await promote(4)).toBe('not_found');
  });

  it('clears a waiting guest who is already listed instead of listing them twice', async () => {
    await request('@one');
    await request('@two');
    await request('@three');
    const [waiting] = sqlite.prepare('SELECT id FROM access_waitlist').all() as { id: string }[];
    // Listed meanwhile by a path that does not clean up (written directly here).
    sqlite.exec(`INSERT INTO access_requests (id, event_id, artist_id, name, instagram, privacy_consent, created_at)
      VALUES ('req-x', 'TRM-03', '03-HOST', 'Three', '@three', 1, '2026-11-12T00:30:00.000Z')`);
    expect(await promoteWaitlistedGuest(db, {
      id: waiting.id, eventId: 'TRM-03', artistId: '03-B', guestLimit: 5, promotedAt: '2026-11-12T01:00:00.000Z',
    })).toBe('already_listed');
    expect(count('access_requests', "lower(ltrim(instagram, '@')) = 'three'")).toBe(1);
    expect(count('access_waitlist')).toBe(0);
  });
});
