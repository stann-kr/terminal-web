import type { SubmissionTrace } from './record';

export const TRACE_RETENTION_DAYS = 90;

const COLUMNS = [
  'kind', 'record_id', 'created_at', 'country', 'region', 'city', 'asn', 'as_org', 'ip_hash',
  'browser', 'os', 'device', 'entry_kind', 'entry_artist_id', 'entry_event_id', 'entry_referrer', 'entry_at',
] as const;

// A replayed submission (the same Transmit idempotency key) keeps its first trace.
export const INSERT_TRACE_SQL = `INSERT INTO submission_traces (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT(kind, record_id) DO NOTHING`;

export const PURGE_TRACES_SQL = 'DELETE FROM submission_traces WHERE created_at < ?';

export const DELETE_TRACE_SQL = 'DELETE FROM submission_traces WHERE kind = ? AND record_id = ?';

/** The oldest created_at a trace may have at `now` and stay. */
export const retentionCutoff = (now: Date): string =>
  new Date(now.getTime() - TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

/** Writes one trace and, in the same batch, drops traces past the retention period. */
export async function writeTrace(database: Pick<D1Database, 'prepare' | 'batch'>, trace: SubmissionTrace, now: Date): Promise<void> {
  await database.batch([
    database.prepare(INSERT_TRACE_SQL).bind(
      trace.kind, trace.recordId, trace.createdAt, trace.country, trace.region, trace.city, trace.asn,
      trace.asOrg, trace.ipHash, trace.browser, trace.os, trace.device, trace.entryKind,
      trace.entryArtistId, trace.entryEventId, trace.entryReferrer, trace.entryAt,
    ),
    database.prepare(PURGE_TRACES_SQL).bind(retentionCutoff(now)),
  ]);
}
