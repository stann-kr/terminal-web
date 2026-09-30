import { desc, eq, sql } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';
import { transmitLogs } from '@/lib/db/schema';
import {
  TRANSMIT_PAGE_SIZE as PAGE_SIZE,
  toPublicTransmitLog,
  type PublicTransmitLog,
  type TransmitLogPage,
} from './contract';
import type { NewTransmitRecord } from './domain';

const createdAtSortKey = sql<number>`
  CASE
    WHEN typeof(${transmitLogs.createdAt}) IN ('integer', 'real')
      THEN CAST(${transmitLogs.createdAt} AS INTEGER)
    ELSE CAST(strftime('%s', ${transmitLogs.createdAt}) AS INTEGER)
  END
`;

type TransmitDatabase = ReturnType<typeof getDb>;

export type CreateTransmitLogResult =
  | { status: 'created'; log: PublicTransmitLog }
  | { status: 'replay'; log: PublicTransmitLog }
  | { status: 'conflict' };

export async function listTransmitLogs(
  database: TransmitDatabase,
  page: number,
): Promise<TransmitLogPage> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ total }] = await database
    .select({ total: sql<number>`count(*)` })
    .from(transmitLogs)
    .all();

  const logs = await database
    .select({
      id: transmitLogs.id,
      handle: transmitLogs.handle,
      message: transmitLogs.message,
      ts: transmitLogs.ts,
      createdAt: transmitLogs.createdAt,
    })
    .from(transmitLogs)
    .orderBy(desc(createdAtSortKey))
    .limit(PAGE_SIZE)
    .offset(offset)
    .all();

  return {
    logs: logs.map(toPublicTransmitLog),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function createTransmitLog(
  database: TransmitDatabase,
  log: NewTransmitRecord,
): Promise<CreateTransmitLogResult> {
  const created = await database
    .insert(transmitLogs)
    .values(log)
    .onConflictDoNothing({ target: transmitLogs.id })
    .returning({ id: transmitLogs.id })
    .get();

  if (created) return { status: 'created', log: toPublicTransmitLog(log) };

  const existing = await database
    .select({
      id: transmitLogs.id,
      handle: transmitLogs.handle,
      message: transmitLogs.message,
      ts: transmitLogs.ts,
      createdAt: transmitLogs.createdAt,
    })
    .from(transmitLogs)
    .where(eq(transmitLogs.id, log.id))
    .get();

  if (existing && existing.handle === log.handle && existing.message === log.message) {
    return { status: 'replay', log: toPublicTransmitLog(existing) };
  }
  return { status: 'conflict' };
}
