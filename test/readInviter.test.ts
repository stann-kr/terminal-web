import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  listGateArtistRowsByEvent: vi.fn(),
  listGateEventRows: vi.fn(),
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { DB: {} } }) }));
vi.mock('../lib/api/abuseControl', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('../lib/db/client', () => ({ getDb: () => ({}) }));
vi.mock('../lib/gate/d1GateReadRepository', () => ({
  listGateArtistRowsByEvent: mocks.listGateArtistRowsByEvent,
  listGateEventRows: mocks.listGateEventRows,
}));
const { readInviter } = await import('../lib/gate/readInviter');

const headers = async () => ({ 'cf-connecting-ip': '192.0.2.7' });
const ipOf = () => (mocks.enforceRateLimit.mock.calls[0][2] as Request).headers.get('cf-connecting-ip');

describe('invite preview lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00+09:00'));
    mocks.enforceRateLimit.mockResolvedValue({ ok: true });
    mocks.listGateEventRows.mockResolvedValue([{ id: 'TRM-03', data: JSON.stringify({ date: '2026-11-28', time: '23:00 KST', status: 'UPCOMING' }) }]);
    mocks.listGateArtistRowsByEvent.mockResolvedValue([{ id: '03-A', data: JSON.stringify({ guestCode: 'K7QM', guestLimit: 10, name: 'STANN LUMO' }) }]);
  });

  it('names the artist a code belongs to, spending the code-check budget', async () => {
    expect(await readInviter('TRM-03', 'k7qm', headers)).toEqual({ artistId: '03-A', name: 'STANN LUMO' });
    expect(mocks.enforceRateLimit.mock.calls[0][1]).toBe('code-info');
    expect(ipOf()).toBe('192.0.2.7');
  });

  it('reads no artist once the address has spent its budget', async () => {
    mocks.enforceRateLimit.mockResolvedValue({ ok: false, status: 429, error: 'RATE_LIMITED' });
    expect(await readInviter('TRM-03', 'K7QM', headers)).toBeNull();
    expect(mocks.listGateArtistRowsByEvent).not.toHaveBeenCalled();
  });

  it('looks up nothing for an event that is not taking requests', async () => {
    expect(await readInviter('TRM-02', 'K7QM', headers)).toBeNull();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('looks up nothing outside the request window', async () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00+09:00'));
    expect(await readInviter('TRM-03', 'K7QM', headers)).toBeNull();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('falls back to a plain preview when the headers cannot be read', async () => {
    expect(await readInviter('TRM-03', 'K7QM', async () => { throw new Error('no request'); })).toBeNull();
  });
});
