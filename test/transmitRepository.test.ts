import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import {
  createTransmitLog,
  listTransmitLogs,
} from '../lib/transmit/d1TransmitRepository';
import type { NewTransmitRecord } from '../lib/transmit/domain';

const newLog: NewTransmitRecord = {
  id: 'tx_abcdef0123456789',
  handle: 'NODE_ALPHA',
  message: 'hello terminal',
  ts: '2026.08.24 / 01:05',
  createdAt: '2026-08-23T16:05:00.000Z',
};

function createInsertDatabase(
  created: { id: string } | undefined,
  existing?: NewTransmitRecord,
) {
  const getExisting = vi.fn().mockResolvedValue(existing);
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({ get: getExisting }),
    }),
  }));
  const insert = vi.fn(() => ({
    values: () => ({
      onConflictDoNothing: () => ({
        returning: () => ({
          get: vi.fn().mockResolvedValue(created),
        }),
      }),
    }),
  }));

  return { database: { insert, select }, getExisting, select };
}

describe('Transmit D1 repository', () => {
  it('returns the created public record without a replay query', async () => {
    const { database, select } = createInsertDatabase({ id: newLog.id });

    await expect(createTransmitLog(database as never, newLog)).resolves.toEqual({
      status: 'created',
      log: newLog,
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('returns an existing record for an identical idempotent replay', async () => {
    const existing = { ...newLog, ts: '2026.08.24 / 01:04' };
    const { database } = createInsertDatabase(undefined, existing);

    await expect(createTransmitLog(database as never, newLog)).resolves.toEqual({
      status: 'replay',
      log: existing,
    });
  });

  it('rejects an idempotency key reused with a different payload', async () => {
    const { database } = createInsertDatabase(undefined, {
      ...newLog,
      message: 'different payload',
    });

    await expect(createTransmitLog(database as never, newLog)).resolves.toEqual({
      status: 'conflict',
    });
  });

  it('applies the fixed page size and returns public rows', async () => {
    const limit = vi.fn((pageSize: number) => ({
      offset: vi.fn((offset: number) => ({
        all: vi.fn().mockResolvedValue([{ ...newLog, deviceId: 'not-selected' }]),
        observedOffset: offset,
      })),
      observedPageSize: pageSize,
    }));
    let queryIndex = 0;
    const filters: unknown[] = [];
    const database = {
      select: vi.fn(() => {
        queryIndex += 1;
        if (queryIndex === 1) {
          return { from: () => ({ where: (filter: unknown) => (filters.push(filter), { all: vi.fn().mockResolvedValue([{ total: 6 }]) }) }) };
        }
        return { from: () => ({ where: (filter: unknown) => (filters.push(filter), { orderBy: () => ({ limit }) }) }) };
      }),
    };

    await expect(listTransmitLogs(database as never, 2)).resolves.toEqual({
      logs: [newLog],
      total: 6,
      page: 2,
      totalPages: 2,
    });
    expect(limit).toHaveBeenCalledWith(5);
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(5);
    // Both the count and the page leave out hidden posts.
    expect(filters).toHaveLength(2);
    const dialect = new SQLiteSyncDialect();
    for (const filter of filters) expect(dialect.sqlToQuery(filter as SQL).sql).toContain('"hidden_at" is null');
  });
});
