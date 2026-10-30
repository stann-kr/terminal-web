import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hostHref, signHostLink, verifyHostLink } from '../lib/gate/hostLink';
import { signUnsubscribe } from '../lib/signal/unsubscribeToken';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getCloudflareContext: vi.fn(),
  loadPublicEvents: vi.fn(),
  listGateEventRows: vi.fn(),
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock('@/lib/api/abuseControl', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@/lib/db/client', () => ({ getDb: () => ({ database: true }) }));
vi.mock('@/lib/events/publicEvents', () => ({ loadPublicEvents: mocks.loadPublicEvents }));
vi.mock('@/lib/gate/d1GateReadRepository', () => ({ listGateEventRows: mocks.listGateEventRows }));
const { POST } = await import('../app/api/invite/host/route');

const SECRET = 'test-secret';
const ARTIST = { guestCode: 'K7QM', guestLimit: 10, name: 'STANN LUMO' };
const GUESTS = [
  { name: '김지현', created_at: '2026-10-29T05:02:00.000Z' },
  { name: 'Park Minjun', created_at: '2026-10-29T04:40:00.000Z' },
];

describe('host link token', () => {
  it('signs the artist and its current code, apart from any unsubscribe token', async () => {
    const token = await signHostLink(SECRET, '03-A', 'k7qm');
    expect(token).toBe(createHmac('sha256', SECRET).update('host:03-A:K7QM').digest('hex'));
    expect(await verifyHostLink(SECRET, '03-A', 'K7QM', token)).toBe(true);
    // A new code retires the link; another artist or an unsubscribe token never passes.
    expect(await verifyHostLink(SECRET, '03-A', 'Z5JR', token)).toBe(false);
    expect(await verifyHostLink(SECRET, '03-B', 'K7QM', token)).toBe(false);
    expect(await verifyHostLink(SECRET, '03-A', 'K7QM', await signUnsubscribe(SECRET, '03-A'))).toBe(false);
    expect(await verifyHostLink('', '03-A', 'K7QM', token)).toBe(false);
    expect(hostHref('03-A', token)).toBe(`/host/03-A?t=${token}`);
  });
});

describe('POST /api/invite/host', () => {
  let artistRow: { event_id: string; data: string } | null;
  const binds: unknown[][] = [];
  beforeEach(() => {
    vi.clearAllMocks();
    binds.length = 0;
    artistRow = { event_id: 'TRM-03', data: JSON.stringify(ARTIST) };
    mocks.enforceRateLimit.mockResolvedValue({ ok: true });
    mocks.loadPublicEvents.mockResolvedValue([{
      id: 'TRM-03', session: 'TERMINAL [03]', subtitle: 'Vulpecula Junction', date: '2026-11-28',
      time: '23:00 KST', venue: 'FAUST SEOUL', status: 'UPCOMING',
    }]);
    mocks.listGateEventRows.mockResolvedValue([{
      id: 'TRM-03', data: JSON.stringify({ date: '2026-11-28', time: '23:00 KST', status: 'UPCOMING' }),
    }]);
    const prepare = (sql: string) => ({
      bind: (...values: unknown[]) => {
        binds.push(values);
        return {
          first: async () => (sql.includes('FROM artists') ? artistRow : null),
          all: async () => ({ results: GUESTS }),
        };
      },
    });
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare } } });
  });
  const post = (body: unknown) => POST(new Request('https://terminal.stann.kr/api/invite/host', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));

  it('gives a valid link its code, count and guest names, and nothing of their contacts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00+09:00'));
    const response = await post({ artistId: '03-A', t: await signHostLink(SECRET, '03-A', 'K7QM') });
    vi.useRealTimers();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({
      artist: 'STANN LUMO',
      event: { id: 'TRM-03', session: 'TERMINAL [03]', subtitle: 'Vulpecula Junction', date: '2026-11-28', time: '23:00 KST', venue: 'FAUST SEOUL', status: 'UPCOMING' },
      code: 'K7QM',
      limit: 10,
      count: 2,
      open: true,
      guests: [
        { name: '김지현', createdAt: '2026-10-29T05:02:00.000Z' },
        { name: 'Park Minjun', createdAt: '2026-10-29T04:40:00.000Z' },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/email|instagram/);
    expect(binds).toContainEqual(['TRM-03', '03-A']);
  });

  it.each([
    ['a forged token', async () => ({ artistId: '03-A', t: 'f'.repeat(64) })],
    ['a token for an older code', async () => ({ artistId: '03-A', t: await signHostLink(SECRET, '03-A', 'OLD1') })],
    ['an artist without a guest code', async () => { artistRow = { event_id: 'TRM-03', data: '{"name":"X"}' }; return { artistId: '03-A', t: await signHostLink(SECRET, '03-A', 'K7QM') }; }],
    ['an unknown artist', async () => { artistRow = null; return { artistId: '03-Z', t: await signHostLink(SECRET, '03-Z', 'K7QM') }; }],
    ['a malformed artist id', async () => ({ artistId: '../x', t: 'f'.repeat(64) })],
  ])('answers %s with the same not-found and reads no guests', async (_label, body) => {
    const response = await post(await body());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'INVALID_HOST_LINK' });
    expect(binds.some((values) => values.length === 2)).toBe(false);
  });

  it('reports a full list as closed', async () => {
    artistRow = { event_id: 'TRM-03', data: JSON.stringify({ ...ARTIST, guestLimit: 2 }) };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00+09:00'));
    const response = await post({ artistId: '03-A', t: await signHostLink(SECRET, '03-A', 'K7QM') });
    vi.useRealTimers();
    expect((await response.json()).open).toBe(false);
  });

  it('rejects unexpected fields before reading anything', async () => {
    const response = await post({ artistId: '03-A', t: 'x', role: 'admin' });
    expect(response.status).toBe(400);
    expect(mocks.getCloudflareContext).not.toHaveBeenCalled();
  });
});
