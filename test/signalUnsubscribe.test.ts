import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeSignalSubscription } from '../lib/signal/d1SignalSubscriptionRepository';
import { signUnsubscribe, verifyUnsubscribe } from '../lib/signal/unsubscribeToken';
import { d1, migratedSqlite, sqliteAvailable } from './sqliteD1';

const mocks = vi.hoisted(() => ({ enforceRateLimit: vi.fn(), getCloudflareContext: vi.fn(), batch: vi.fn(), bind: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock('@/lib/api/abuseControl', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
const { GET, POST } = await import('../app/api/signal/unsubscribe/route');

const SECRET = 'test-secret';
const ID = 'sig-1714000000000-ab1cd';

describe('Signal unsubscribe token', () => {
  it('signs as the mail script does (HMAC-SHA256 hex) and verifies only its own id', async () => {
    const token = await signUnsubscribe(SECRET, ID);
    expect(token).toBe(createHmac('sha256', SECRET).update(ID).digest('hex'));
    expect(await verifyUnsubscribe(SECRET, ID, token)).toBe(true);
    expect(await verifyUnsubscribe(SECRET, 'sig-1714000000000-ab1ce', token)).toBe(false);
    expect(await verifyUnsubscribe(SECRET, ID, token.replace(/.$/, c => (c === '0' ? '1' : '0')))).toBe(false);
    expect(await verifyUnsubscribe('', ID, token)).toBe(false);
  });
});

describe('POST /api/signal/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue({ ok: true });
    mocks.bind.mockReturnValue({});
    mocks.batch.mockResolvedValue([]);
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare: () => ({ bind: mocks.bind }), batch: mocks.batch } } });
  });
  const post = (query: string) => POST(new Request(`https://terminal.stann.kr/api/signal/unsubscribe?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
  }));

  it('deletes the subscription a valid one-click link names', async () => {
    const response = await post(`s=${ID}&t=${await signUnsubscribe(SECRET, ID)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.bind).toHaveBeenCalledWith(ID);
    expect(mocks.batch).toHaveBeenCalledTimes(1);
  });

  it('refuses a forged link without touching the database', async () => {
    const response = await post(`s=${ID}&t=${'0'.repeat(64)}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_UNSUBSCRIBE_LINK' });
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('GET never deletes: it opens the SIGNAL plate with the same link', () => {
    const response = GET(new Request(`https://terminal.stann.kr/api/signal/unsubscribe?s=${ID}&t=abc`));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`https://terminal.stann.kr/signal?s=${ID}&t=abc`);
    expect(mocks.bind).not.toHaveBeenCalled();
  });
});

describe.skipIf(!sqliteAvailable)('unsubscribe SQL (SQLite with every migration)', () => {
  it('forgets the email a guest request kept for news, and leaves every other guest alone', async () => {
    const sqlite = migratedSqlite();
    sqlite.exec(`INSERT INTO events (id, data) VALUES ('TRM-03', '{}')`);
    sqlite.exec(`INSERT INTO access_requests (id, event_id, name, email, instagram, privacy_consent, marketing_consent, created_at) VALUES
      ('req-1', 'TRM-03', 'One', 'one@example.com', '@one', 1, 1, '2026-11-12T00:00:00.000Z'),
      ('req-2', 'TRM-03', 'Two', 'two@example.com', '@two', 1, 1, '2026-11-12T00:00:01.000Z'),
      ('req-3', 'TRM-03', 'Three', NULL, '@three', 1, 0, '2026-11-12T00:00:02.000Z')`);
    sqlite.exec(`INSERT INTO signal (id, name, email, instagram, source, created_at) VALUES
      ('sig-1', 'One', 'one@example.com', '@one', 'gate', '2026-11-12T00:00:00.000Z'),
      ('sig-2', 'Two', 'two@example.com', '@two', 'gate', '2026-11-12T00:00:01.000Z')`);
    const rows = () => sqlite.prepare('SELECT id, email, marketing_consent AS news FROM access_requests ORDER BY id').all();

    await removeSignalSubscription(d1(sqlite), 'sig-1');
    expect(sqlite.prepare('SELECT id FROM signal').all()).toEqual([{ id: 'sig-2' }]);
    expect(rows()).toEqual([
      { id: 'req-1', email: null, news: 0 },
      { id: 'req-2', email: 'two@example.com', news: 1 },
      { id: 'req-3', email: null, news: 0 },
    ]);
    // A repeat (the mail client posts again) changes nothing more.
    await removeSignalSubscription(d1(sqlite), 'sig-1');
    expect(rows()).toHaveLength(3);
    expect(sqlite.prepare('SELECT id FROM signal').all()).toEqual([{ id: 'sig-2' }]);
  });
});

describe('GET /calendar/subscribe', () => {
  it('sends Apple devices to the webcal feed and others to Google Calendar', async () => {
    const { GET: subscribe } = await import('../app/calendar/subscribe/route');
    const go = (ua: string) => subscribe(new Request('https://terminal.stann.kr/calendar/subscribe', { headers: { 'user-agent': ua } })).headers.get('location');
    expect(go('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('webcal://terminal.stann.kr/calendar.ics');
    expect(go('Mozilla/5.0 (Linux; Android 15)')).toBe(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent('webcal://terminal.stann.kr/calendar.ics')}`);
  });
});
