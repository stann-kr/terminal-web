import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackMail, mailStatMessage as scriptMessage } from '../scripts/lib/signalMail.mjs';
import { mailStatMessage, recordMailStat, signMailStat, verifyMailStat } from '../lib/mail/stats';
import { d1, migratedSqlite, sqliteAvailable } from './sqliteD1';

const mocks = vi.hoisted(() => ({ getCloudflareContext: vi.fn(), run: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }));
const open = await import('../app/api/mail/open/route');
const click = await import('../app/api/mail/click/route');

const SECRET = 'test-secret';
const KEY = '2d100290b1e1147a';
const SITE = 'https://terminal.stann.kr';
const sign = (message: string) => createHmac('sha256', SECRET).update(message).digest('hex');

describe('mail stats signatures', () => {
  it('signs what the mail script signs, apart from unsubscribe ids', async () => {
    expect(scriptMessage(KEY, 'https://ra.co/events/1')).toBe(mailStatMessage(KEY, 'https://ra.co/events/1'));
    expect(await signMailStat(SECRET, KEY)).toBe(sign(`mail-stat:${KEY}:`));
    expect(await verifyMailStat(SECRET, KEY, '', sign(mailStatMessage(KEY)))).toBe(true);
    // A pixel's signature does not open a link, and no link but an https one is followed.
    expect(await verifyMailStat(SECRET, KEY, 'https://ra.co/', sign(mailStatMessage(KEY)))).toBe(false);
    expect(await verifyMailStat(SECRET, KEY, 'javascript:alert(1)', sign(mailStatMessage(KEY, 'javascript:alert(1)')))).toBe(false);
    expect(await verifyMailStat(SECRET, 'not-a-key', '', sign(mailStatMessage('not-a-key')))).toBe(false);
    expect(await verifyMailStat('', KEY, '', sign(mailStatMessage(KEY)))).toBe(false);
  });
});

describe('trackMail', () => {
  it('sends https links through the click route, adds the pixel and leaves the rest alone', () => {
    const html = '<body><a href="https://terminal.stann.kr/events/TRM-03?from=mail&amp;x=1">E</a> <a style="c" href="https://ra.co/events/2579519">RA</a> <a href="mailto:a@b.kr">M</a> <a href="{{UNSUBSCRIBE_URL}}">U</a><img src="https://media.stann.kr/p.jpg"></body>';
    const { html: out, links } = trackMail(html, { site: SITE, key: KEY, sign });
    expect(links).toBe(2);
    const target = 'https://terminal.stann.kr/events/TRM-03?from=mail&x=1';
    expect(out).toContain(`href="${SITE}/api/mail/click?${new URLSearchParams({ k: KEY, u: target, s: sign(mailStatMessage(KEY, target)) }).toString().replaceAll('&', '&amp;')}"`);
    expect(out).toContain('style="c" href="https://terminal.stann.kr/api/mail/click?k=');
    expect(out).toContain('href="mailto:a@b.kr"');
    expect(out).toContain('href="{{UNSUBSCRIBE_URL}}"');
    expect(out).toContain('<img src="https://media.stann.kr/p.jpg">');
    expect(out).toMatch(/<img src="https:\/\/terminal\.stann\.kr\/api\/mail\/open\?k=2d100290b1e1147a&amp;s=[0-9a-f]{64}" width="1" height="1" alt=""[^>]*><\/body>$/);
  });
});

describe('mail stat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue({});
    const prepare = vi.fn(() => ({ bind: (...args: unknown[]) => ({ run: () => mocks.run(...args) }) }));
    mocks.getCloudflareContext.mockResolvedValue({ env: { SIGNAL_UNSUBSCRIBE_SECRET: SECRET, DB: { prepare } } });
  });

  it('answers the pixel uncached and counts only a signed one', async () => {
    const signed = await open.GET(new Request(`${SITE}/api/mail/open?k=${KEY}&s=${sign(mailStatMessage(KEY))}`));
    expect(signed.headers.get('content-type')).toBe('image/gif');
    expect(signed.headers.get('cache-control')).toContain('no-store');
    expect((await signed.arrayBuffer()).byteLength).toBeGreaterThan(30);
    expect(mocks.run).toHaveBeenCalledWith(KEY, expect.stringMatching(/^\d{4}-\d\d-\d\d$/), 'open', '');
    const forged = await open.GET(new Request(`${SITE}/api/mail/open?k=${KEY}&s=${'0'.repeat(64)}`));
    expect(forged.headers.get('content-type')).toBe('image/gif');
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it('follows and counts a signed link, and sends anything else Home uncounted', async () => {
    const target = 'https://ra.co/events/2579519';
    const followed = await click.GET(new Request(`${SITE}/api/mail/click?${new URLSearchParams({ k: KEY, u: target, s: sign(mailStatMessage(KEY, target)) })}`));
    expect(followed.status).toBe(302);
    expect(followed.headers.get('location')).toBe(target);
    expect(mocks.run).toHaveBeenCalledWith(KEY, expect.any(String), 'click', target);
    const elsewhere = await click.GET(new Request(`${SITE}/api/mail/click?${new URLSearchParams({ k: KEY, u: 'https://evil.example/', s: sign(mailStatMessage(KEY, target)) })}`));
    expect(elsewhere.headers.get('location')).toBe(`${SITE}/`);
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it('still answers when the count cannot be written', async () => {
    mocks.run.mockRejectedValue(new Error('no such table: mail_stats'));
    const target = 'https://ra.co/events/2579519';
    const followed = await click.GET(new Request(`${SITE}/api/mail/click?${new URLSearchParams({ k: KEY, u: target, s: sign(mailStatMessage(KEY, target)) })}`));
    expect(followed.headers.get('location')).toBe(target);
  });
});

describe.skipIf(!sqliteAvailable)('mail_stats (SQLite with every migration)', () => {
  it('adds up loads per mail, day, kind and link', async () => {
    const sqlite = migratedSqlite();
    const now = new Date('2026-11-24T15:31:00.000Z');
    for (const target of ['', '', 'https://ra.co/events/2579519']) {
      await recordMailStat(d1(sqlite), { key: KEY, kind: target ? 'click' : 'open', target, now });
    }
    expect(sqlite.prepare('SELECT day, kind, target, count FROM mail_stats ORDER BY kind').all()).toEqual([
      { day: '2026-11-25', kind: 'click', target: 'https://ra.co/events/2579519', count: 1 },
      { day: '2026-11-25', kind: 'open', target: '', count: 2 },
    ]);
  });
});
