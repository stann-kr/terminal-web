import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUnsubscribe, verifyUnsubscribe } from '../lib/signal/unsubscribeToken';

const mocks = vi.hoisted(() => ({ enforceRateLimit: vi.fn(), getCloudflareContext: vi.fn(), run: vi.fn(), bind: vi.fn() }));
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
    mocks.bind.mockReturnValue({ run: mocks.run });
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare: () => ({ bind: mocks.bind }) } } });
  });
  const post = (query: string) => POST(new Request(`https://terminal.stann.kr/api/signal/unsubscribe?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
  }));

  it('deletes the subscription a valid one-click link names', async () => {
    const response = await post(`s=${ID}&t=${await signUnsubscribe(SECRET, ID)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.bind).toHaveBeenCalledWith(ID);
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

describe('GET /calendar/subscribe', () => {
  it('sends Apple devices to the webcal feed and others to Google Calendar', async () => {
    const { GET: subscribe } = await import('../app/calendar/subscribe/route');
    const go = (ua: string) => subscribe(new Request('https://terminal.stann.kr/calendar/subscribe', { headers: { 'user-agent': ua } })).headers.get('location');
    expect(go('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('webcal://terminal.stann.kr/calendar.ics');
    expect(go('Mozilla/5.0 (Linux; Android 15)')).toBe(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent('webcal://terminal.stann.kr/calendar.ics')}`);
  });
});
