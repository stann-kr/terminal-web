import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signHostLink } from '../lib/gate/hostLink';
import KIT from './fixtures/kit-TRM-03.json';

const mocks = vi.hoisted(() => ({ enforceRateLimit: vi.fn(), getCloudflareContext: vi.fn(), get: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock('@/lib/api/abuseControl', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
const { GET } = await import('../app/api/invite/host/file/route');

const SECRET = 'test-secret';
const HOGUN_FRONT = 'trm-03/hogun-front.0596ca9196b0.png';

describe('GET /api/invite/host/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue({ ok: true });
    mocks.get.mockImplementation(async (key: string) => (key === 'kit/TRM-03.json'
      ? { json: async () => KIT }
      : { body: `bytes of ${key}`, size: 8 }));
    const prepare = () => ({ bind: () => ({ first: async () => ({ event_id: 'TRM-03', data: JSON.stringify({ name: 'HOGUN', guestCode: '3J5W', guestLimit: 10 }) }) }) });
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare }, PRESS: { get: mocks.get } } });
  });
  const get = async (key: string, token?: string) => GET(new Request(`https://terminal.stann.kr/api/invite/host/file?${new URLSearchParams({
    a: '03-B', t: token ?? await signHostLink(SECRET, '03-B', '3J5W'), f: key,
  })}`));

  it("hands the artist their own poster as a download", async () => {
    const response = await get(HOGUN_FRONT);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="TERMINAL[03]_hogun_front.png"');
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(mocks.get).toHaveBeenLastCalledWith(HOGUN_FRONT);
  });

  it('shows a preview inline, and the event teaser too', async () => {
    const preview = await get('trm-03/teaser.af058b046376.thumb.jpg');
    expect(preview.headers.get('content-type')).toBe('image/jpeg');
    expect(preview.headers.get('content-disposition')).toBeNull();
  });

  it.each([
    ["another artist's poster", 'trm-03/yaree-front.a4e2851ed6da.png', undefined],
    ['a key outside the list', 'trm-03/../secret.png', undefined],
    ['a forged token', HOGUN_FRONT, 'f'.repeat(64)],
  ])('answers %s with the same 404 and reads nothing', async (_label, key, token) => {
    const response = await get(key, token);
    expect(response.status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalledWith(key);
  });

  it('lists nothing when the event has no manifest in the bucket', async () => {
    mocks.get.mockResolvedValue(null);
    expect((await get(HOGUN_FRONT)).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalledWith(HOGUN_FRONT);
  });
});
