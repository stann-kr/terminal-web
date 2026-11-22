import { describe, expect, it } from 'vitest';
import { inviteHref } from '../features/access/invite';
import { removeSignalSubscription } from '../lib/signal/d1SignalSubscriptionRepository';
import {
  entryFromVisit,
  parseEntry,
  readEntryCookie,
  serializeEntry,
  shouldStoreEntry,
  type Entry,
} from '../lib/trace/entry';
import { retentionCutoff, writeTrace } from '../lib/trace/d1TraceRepository';
import { addressKey, buildTrace, hashAddress, summarizeUserAgent } from '../lib/trace/record';
import { d1, migratedSqlite, sqliteAvailable } from './sqliteD1';

const NOW = new Date('2026-11-18T03:46:11.000Z');
const visit = (path: string, referer: string | null = null) =>
  entryFromVisit(new URL(`https://terminal.stann.kr${path}`), referer, NOW);

describe('entry from a page visit', () => {
  it('reads an artist code link, a host page (never its token) and an outside site', () => {
    expect(visit('/events/TRM-03/request?invite=HOGUN03', 'https://l.instagram.com/')).toEqual({
      kind: 'code', target: 'TRM-03', code: 'HOGUN03', referrer: 'l.instagram.com', at: NOW.toISOString(),
    });
    const host = visit('/host/03-B?t=secret-token', 'https://www.facebook.com/');
    expect(host).toEqual({ kind: 'host', target: '03-B', referrer: 'www.facebook.com', at: NOW.toISOString() });
    expect(JSON.stringify(host)).not.toContain('secret-token');
    expect(visit('/', 'https://l.instagram.com/x')).toEqual({ kind: 'ref', referrer: 'l.instagram.com', at: NOW.toISOString() });
  });

  it('reads the very link an artist shares (inviteHref), not a look-alike key', () => {
    expect(visit(inviteHref('TRM-03', '3J5W'))).toMatchObject({ kind: 'code', target: 'TRM-03', code: '3J5W' });
    expect(visit('/events/TRM-03/request?code=3J5W')).toBeNull();
  });

  it('names no entry for a direct or same-site visit, or a malformed link', () => {
    expect(visit('/transmit')).toBeNull();
    expect(visit('/events/TRM-03', 'https://terminal.stann.kr/')).toBeNull();
    expect(visit('/events/TRM-03/request?invite=%3Cscript%3E')).toBeNull();
    expect(visit('/host/%E0%A4%A')).toBeNull();
  });

  it('lets an artist link or host page replace a stored entry, an outside site only fill an empty one', () => {
    const stored = visit('/host/03-B')!;
    expect(shouldStoreEntry(visit('/', 'https://google.com/'), stored)).toBe(false);
    expect(shouldStoreEntry(visit('/', 'https://google.com/'), null)).toBe(true);
    expect(shouldStoreEntry(visit('/events/TRM-03/request?invite=X1'), stored)).toBe(true);
    expect(shouldStoreEntry(null, null)).toBe(false);
  });

  it('round-trips through the cookie and rejects one it did not write', () => {
    const entry = visit('/events/TRM-03/request?invite=HOGUN03')!;
    expect(parseEntry(serializeEntry(entry))).toEqual(entry);
    // The raw header carries the value percent-encoded, as Next writes it.
    expect(readEntryCookie(`a=1; tw_entry=${encodeURIComponent(serializeEntry(entry))}; b=2`)).toEqual(entry);
    expect(parseEntry('{"kind":"host","at":"2026-11-18T00:00:00.000Z"}')).toBeNull();
    expect(parseEntry('{"kind":"code","target":"TRM-03","at":"2026-11-18T00:00:00.000Z"}')).toBeNull();
    expect(parseEntry('{"kind":"ref","referrer":"<x>","at":"2026-11-18T00:00:00.000Z"}')).toBeNull();
    expect(parseEntry('not json')).toBeNull();
    expect(readEntryCookie('tw_entry=%E0%A4%A')).toBeNull();
  });
});

describe('trace record', () => {
  it('summarizes in-app and ordinary browsers', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0')).toEqual({ browser: 'Instagram', os: 'iOS', device: 'mobile' });
    expect(summarizeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toEqual({ browser: 'Chrome', os: 'Windows', device: 'desktop' });
    expect(summarizeUserAgent(null)).toEqual({ browser: null, os: null, device: null });
  });

  it('keys IPv4 whole and IPv6 by its /64, and hashes only with the secret', async () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey('2001:db8:0:1:aaaa::1')).toBe('2001:db8:0:1::/64');
    expect(addressKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(addressKey('2001:DB8:0:1:bbbb:cccc:dddd:eeee')).toBe('2001:db8:0:1::/64');
    expect(addressKey('not an ip')).toBeNull();
    const hash = await hashAddress('203.0.113.7', 'k');
    expect(hash).toMatch(/^[0-9a-f]{24}$/);
    expect(await hashAddress('203.0.113.7', 'k')).toBe(hash);
    expect(await hashAddress('203.0.113.8', 'k')).not.toBe(hash);
    expect(await hashAddress('203.0.113.7', undefined)).toBeNull();
  });

  it('builds from Cloudflare properties, trusting only cf-connecting-ip, and resolves the entry', async () => {
    const entry: Entry = { kind: 'code', target: 'TRM-03', code: 'HOGUN03', referrer: 'l.instagram.com', at: '2026-11-17T00:00:00.000Z' };
    const trace = await buildTrace({
      kind: 'transmit',
      recordId: 'tx_1',
      now: NOW,
      headers: new Headers({ 'x-forwarded-for': '198.51.100.1', 'user-agent': 'Mozilla/5.0 (Macintosh; Mac OS X 10_15_7) Version/18.0 Safari/605.1.15' }),
      cf: { country: 'KR', region: 'Seoul', city: 'Seoul', asn: 4766, asOrganization: 'Korea Telecom' },
      entry,
      codeArtistId: '03-B',
      secret: 'k',
    });
    expect(trace).toEqual({
      kind: 'transmit', recordId: 'tx_1', createdAt: NOW.toISOString(),
      country: 'KR', region: 'Seoul', city: 'Seoul', asn: 4766, asOrg: 'Korea Telecom',
      ipHash: null, browser: 'Safari', os: 'macOS', device: 'desktop',
      entryKind: 'code', entryArtistId: '03-B', entryEventId: 'TRM-03', entryReferrer: 'l.instagram.com', entryAt: entry.at,
    });
  });
});

describe.skipIf(!sqliteAvailable)('submission_traces (SQLite with every migration)', () => {
  const trace = (recordId: string, createdAt: string, kind: 'transmit' | 'signal' = 'transmit') => ({
    kind, recordId, createdAt, country: 'KR', region: null, city: null, asn: null, asOrg: null, ipHash: 'h',
    browser: null, os: null, device: null, entryKind: null, entryArtistId: null, entryEventId: null, entryReferrer: null, entryAt: null,
  } as const);

  it('keeps the first trace of a record and drops traces past 90 days on each write', async () => {
    const sqlite = migratedSqlite();
    const old = new Date(new Date(retentionCutoff(NOW)).getTime() - 1000).toISOString();
    await writeTrace(d1(sqlite), trace('tx_old', old), new Date(old));
    await writeTrace(d1(sqlite), trace('tx_1', NOW.toISOString()), NOW);
    await writeTrace(d1(sqlite), { ...trace('tx_1', NOW.toISOString()), country: 'US' }, NOW);
    expect(sqlite.prepare('SELECT record_id, country FROM submission_traces ORDER BY record_id').all())
      .toEqual([{ record_id: 'tx_1', country: 'KR' }]);
  });

  it('forgets a Signal subscription trace on unsubscribe and leaves others', async () => {
    const sqlite = migratedSqlite();
    await writeTrace(d1(sqlite), trace('sig-1', NOW.toISOString(), 'signal'), NOW);
    await writeTrace(d1(sqlite), trace('sig-2', NOW.toISOString(), 'signal'), NOW);
    await removeSignalSubscription(d1(sqlite), 'sig-1');
    expect(sqlite.prepare('SELECT record_id FROM submission_traces').all()).toEqual([{ record_id: 'sig-2' }]);
  });
});
