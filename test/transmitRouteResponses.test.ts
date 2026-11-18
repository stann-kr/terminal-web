import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTransmitLog: vi.fn(),
  enforceRateLimit: vi.fn(),
  getCloudflareContext: vi.fn(),
  getDb: vi.fn(),
  listTransmitLogs: vi.fn(),
  recordSubmission: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));
vi.mock('@/lib/api/abuseControl', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('@/lib/db/client', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/trace/recordSubmission', () => ({ recordSubmission: mocks.recordSubmission }));
vi.mock('@/lib/transmit/d1TransmitRepository', () => ({
  createTransmitLog: mocks.createTransmitLog,
  listTransmitLogs: mocks.listTransmitLogs,
}));

import { GET, POST } from '../app/api/transmit/route';

const publicLog = {
  id: 'tx_abcdef0123456789',
  handle: 'NODE_ALPHA',
  message: 'hello terminal',
  ts: '2026.08.24 / 01:05',
  createdAt: '2026-08-23T16:05:00.000Z',
};

function postRequest(body: unknown, idempotencyKey = 'abcdef0123456789') {
  return new Request('https://terminal.test/api/transmit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
  });
}

async function responseDetails(response: Response) {
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    body: await response.json(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.getCloudflareContext.mockReturnValue({ env: { DB: {} } });
  mocks.getDb.mockReturnValue({ database: true });
  mocks.enforceRateLimit.mockResolvedValue({ ok: true });
});

describe('Transmit route response contract', () => {
  it('returns the requested page through the public no-store contract', async () => {
    mocks.listTransmitLogs.mockResolvedValue({
      logs: [publicLog],
      total: 6,
      page: 2,
      totalPages: 2,
    });

    const response = await responseDetails(await GET(
      new Request('https://terminal.test/api/transmit?page=2'),
    ));

    expect(response).toEqual({
      status: 200,
      cacheControl: 'no-store',
      body: { logs: [publicLog], total: 6, page: 2, totalPages: 2 },
    });
    expect(mocks.listTransmitLogs).toHaveBeenCalledWith({ database: true }, 2);
  });

  it('rejects invalid pages before opening a database context', async () => {
    const response = await responseDetails(await GET(
      new Request('https://terminal.test/api/transmit?page=0'),
    ));

    expect(response).toEqual({
      status: 400,
      cacheControl: 'no-store',
      body: { error: 'INVALID_PAGE' },
    });
    expect(mocks.getCloudflareContext).not.toHaveBeenCalled();
  });

  it.each([
    ['created', 201],
    ['replay', 200],
  ] as const)('maps a %s submission to its established status', async (status, expectedStatus) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(publicLog.createdAt));
    mocks.createTransmitLog.mockResolvedValue({ status, log: publicLog });

    const response = await responseDetails(await POST(postRequest({
      handle: ' node alpha ',
      message: ' hello terminal ',
    })));

    expect(response).toEqual({
      status: expectedStatus,
      cacheControl: 'no-store',
      body: publicLog,
    });
    expect(mocks.createTransmitLog).toHaveBeenCalledWith(
      { database: true },
      publicLog,
    );
    // Only the first write is traced: a replay keeps the trace the original left.
    if (status === 'created') {
      expect(mocks.recordSubmission).toHaveBeenCalledWith(expect.any(Request), 'transmit', publicLog.id, expect.any(Date));
    } else {
      expect(mocks.recordSubmission).not.toHaveBeenCalled();
    }
  });

  it('keeps idempotency conflicts opaque and non-cacheable', async () => {
    mocks.createTransmitLog.mockResolvedValue({ status: 'conflict' });

    const response = await responseDetails(await POST(postRequest({
      handle: 'NODE_ALPHA',
      message: 'different payload',
    })));

    expect(response).toEqual({
      status: 409,
      cacheControl: 'no-store',
      body: { error: 'IDEMPOTENCY_CONFLICT' },
    });
  });

  it('maps rate limiting before persistence', async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      ok: false,
      error: 'RATE_LIMITED',
      status: 429,
    });

    const response = await responseDetails(await POST(postRequest({
      handle: 'NODE_ALPHA',
      message: 'hello terminal',
    })));

    expect(response).toEqual({
      status: 429,
      cacheControl: 'no-store',
      body: { error: 'RATE_LIMITED' },
    });
    expect(mocks.createTransmitLog).not.toHaveBeenCalled();
  });
});
