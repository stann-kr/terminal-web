import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAccessRequestAtomically,
  promoteWaitlistedGuest,
  type AtomicAccessRequestInput,
} from '../lib/gate/d1AccessRequestRepository';

/**
 * The waitlist SQL against a real SQLite built from every migration, so the batch order (insert,
 * clean-up, waitlist, state) and the conditions in each statement are exercised, not just their
 * text. node:sqlite stands in for D1: a batch runs its statements in order inside one transaction.
 */
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...values: unknown[]): unknown[]; run(...values: unknown[]): { changes: number | bigint } };
};
let DatabaseSync: (new (file: string) => SqliteDatabase) | undefined;
try {
  ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite'));
} catch {
  DatabaseSync = undefined;
}

function d1(sqlite: SqliteDatabase) {
  const statement = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...next: unknown[]) => statement(sql, next),
  });
  const run = ({ sql, values }: { sql: string; values: unknown[] }) => {
    const prepared = sqlite.prepare(sql);
    if (/^\s*(SELECT|WITH)/i.test(sql)) return { success: true, meta: { changes: 0 }, results: prepared.all(...values) };
    return { success: true, meta: { changes: Number(prepared.run(...values).changes) }, results: [] };
  };
  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: { sql: string; values: unknown[] }[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(run);
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as Pick<D1Database, 'prepare' | 'batch'>;
}

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

describe.skipIf(!DatabaseSync)('access waitlist SQL (SQLite with every migration)', () => {
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
    sqlite = new DatabaseSync!(':memory:');
    for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
      for (const sql of readFileSync(path.join(MIGRATIONS, file), 'utf8').split('--> statement-breakpoint')) {
        if (sql.trim()) sqlite.exec(sql);
      }
    }
    sqlite.exec(`INSERT INTO events (id, data) VALUES ('TRM-03', '{}')`);
    sqlite.exec(`INSERT INTO artists (id, event_id, data) VALUES ('03-B', 'TRM-03', '{}'), ('03-HOST', 'TRM-03', '{}')`);
    db = d1(sqlite);
    serial = 0;
  });

  it('lists guests up to the limit, then waits the rest, once each', async () => {
    expect(await request('@one')).toEqual({ status: 'created' });
    expect(await request('@two')).toEqual({ status: 'created' });
    expect(await request('@three')).toEqual({ status: 'waitlisted' });
    // The same guest again (case and @ aside) still waits, only once.
    expect(await request('THREE')).toEqual({ status: 'waitlisted' });
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
