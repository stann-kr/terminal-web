export interface PublicTransmitLog {
  id: string;
  handle: string;
  message: string;
  ts: string;
  createdAt: string;
}

/** Entries per server page of the public log (`GET /api/transmit?page=N`). */
export const TRANSMIT_PAGE_SIZE = 5;

export interface TransmitLogPage {
  logs: PublicTransmitLog[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PostTransmitInput {
  handle: string;
  message: string;
  idempotencyKey?: string;
}

type TransmitLogSource = Omit<PublicTransmitLog, 'createdAt'> & {
  createdAt: string | number | null;
  deviceId?: string | null;
};

const LEGACY_TIMESTAMP_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2}) \/ (\d{2}):(\d{2})$/;

export function normalizeTransmitCreatedAt(
  createdAt: string | number | null,
  displayTimestamp: string,
): string {
  if (typeof createdAt === 'string' && createdAt.trim()) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) {
    const milliseconds = Math.abs(createdAt) < 1_000_000_000_000
      ? createdAt * 1_000
      : createdAt;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const legacyTimestamp = LEGACY_TIMESTAMP_PATTERN.exec(displayTimestamp);
  if (legacyTimestamp) {
    const [, year, month, day, hour, minute] = legacyTimestamp;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  throw new Error('Invalid stored transmit timestamp');
}

/** Removes storage-only identifiers before a transmit log crosses the public API boundary. */
export function toPublicTransmitLog(log: TransmitLogSource): PublicTransmitLog {
  return {
    id: log.id,
    handle: log.handle,
    message: log.message,
    ts: log.ts,
    createdAt: normalizeTransmitCreatedAt(log.createdAt, log.ts),
  };
}
