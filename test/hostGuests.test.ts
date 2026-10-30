import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signHostLink } from '../lib/gate/hostLink';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getCloudflareContext: vi.fn(),
  listGateEventRows: vi.fn(),
  createAccessRequestAtomically: vi.fn(),
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock('@/lib/api/abuseControl', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@/lib/db/client', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/gate/d1GateReadRepository', () => ({ listGateEventRows: mocks.listGateEventRows }));
vi.mock('@/lib/gate/d1AccessRequestRepository', () => ({ createAccessRequestAtomically: mocks.createAccessRequestAtomically }));
vi.mock('@/lib/utils/id', () => ({ generateId: (prefix: string) => `${prefix}-1` }));
const { POST } = await import('../app/api/invite/host/guests/route');

const SECRET = 'test-secret';
const ARTIST = { name: 'HOGUN', guestCode: '3J5W', guestLimit: 10 };

describe('POST /api/invite/host/guests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00+09:00'));
    mocks.enforceRateLimit.mockResolvedValue({ ok: true });
    mocks.createAccessRequestAtomically.mockResolvedValue({ status: 'created' });
    mocks.listGateEventRows.mockResolvedValue([{ id: 'TRM-03', data: JSON.stringify({ date: '2026-11-28', time: '23:00 KST', status: 'UPCOMING' }) }]);
    const prepare = () => ({ bind: () => ({ first: async () => ({ event_id: 'TRM-03', data: JSON.stringify(ARTIST) }) }) });
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare } } });
  });
  const post = async (overrides: object = {}) => POST(new Request('https://terminal.stann.kr/api/invite/host/guests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ artistId: '03-B', t: await signHostLink(SECRET, '03-B', '3J5W'), name: ' 김지현 ', instagram: '@Ji.Hyun', consent: true, ...overrides }),
  }));

  it('lists the guest under the artist, with no email and no news', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(mocks.createAccessRequestAtomically).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventId: 'TRM-03', artistId: '03-B', invitedBy: 'HOGUN', name: '김지현', instagram: '@ji.hyun',
      email: null, marketingConsent: false, guestLimit: 10,
    }));
  });

  it.each([
    ['duplicate', 'GUEST_ALREADY_LISTED'],
    ['guest_limit_reached', 'GUEST_LIMIT_REACHED'],
  ])('tells the artist plainly when the list says %s', async (status, error) => {
    mocks.createAccessRequestAtomically.mockResolvedValue({ status });
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error });
  });

  it('writes nothing for a link that does not hold', async () => {
    const response = await post({ t: 'f'.repeat(64) });
    expect(response.status).toBe(404);
    expect(mocks.createAccessRequestAtomically).not.toHaveBeenCalled();
  });

  it.each([
    [{ consent: false }, 'GUEST_CONSENT_REQUIRED'],
    [{ instagram: '@@x' }, 'INVALID_INSTAGRAM_FORMAT'],
    [{ name: ' ' }, 'ALL_FIELDS_REQUIRED'],
  ])('refuses %j before any read', async (overrides, error) => {
    const response = await post(overrides);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(mocks.getCloudflareContext).not.toHaveBeenCalled();
  });

  it('writes nothing outside the request window', async () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00+09:00'));
    const response = await post();
    expect(response.status).toBe(403);
    expect(mocks.createAccessRequestAtomically).not.toHaveBeenCalled();
  });
});
