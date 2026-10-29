import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const persistRoots = [
  mkdtempSync(path.join(tmpdir(), 'terminal-2-d1-fresh-')),
  mkdtempSync(path.join(tmpdir(), 'terminal-2-d1-legacy-')),
  mkdtempSync(path.join(tmpdir(), 'terminal-2-d1-invalid-')),
];
const [freshPersistTo, legacyPersistTo, invalidPersistTo] = persistRoots;
const env = { ...process.env, CI: '1', NO_COLOR: '1' };
const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args], {
  cwd: process.cwd(),
  env,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const execute = (persistTo, command) => JSON.parse(wrangler(
  'd1', 'execute', 'terminal-db', '--local', '--persist-to', persistTo,
  '--command', command,
  '--json',
));
const executeFile = (persistTo, file) => JSON.parse(wrangler(
  'd1', 'execute', 'terminal-db', '--local', '--persist-to', persistTo,
  '--file', file,
  '--json',
));

const legacyMigrationFiles = [
  '0000_special_legion.sql',
  '0001_flexible_schema.sql',
  '0002_access_requests.sql',
  '0003_transmit_device_id.sql',
  '0004_event_invitation_lines.sql',
  '0005_marketing_consent.sql',
  '0006_dj_guest_codes.sql',
  '0007_invited_by_nullable.sql',
  '0008_signal.sql',
];
const legacyMigrationsSql = legacyMigrationFiles
  .map((file) => readFileSync(path.join('migrations', file), 'utf8'))
  .join('\n');
const normalizeTransmitMigration = path.join(
  'migrations',
  '0009_normalize_transmit_created_at.sql',
);
const optionalEmailMigration = path.join(
  'migrations',
  '0010_access_request_email_optional.sql',
);

function assertFinalTransmitSchema(persistTo, label) {
  const [tableInfoResult, indexListResult] = execute(persistTo, `
    PRAGMA table_info('transmit_logs');
    PRAGMA index_list('transmit_logs');
  `);
  const columns = tableInfoResult.results;
  const expectedColumns = [
    { name: 'id', type: 'TEXT', notnull: 1, defaultValue: null, pk: 1 },
    { name: 'handle', type: 'TEXT', notnull: 1, defaultValue: null, pk: 0 },
    { name: 'message', type: 'TEXT', notnull: 1, defaultValue: null, pk: 0 },
    { name: 'ts', type: 'TEXT', notnull: 1, defaultValue: null, pk: 0 },
    { name: 'created_at', type: 'TEXT', notnull: 1, defaultValue: null, pk: 0 },
    { name: 'device_id', type: 'TEXT', notnull: 0, defaultValue: null, pk: 0 },
  ];

  if (columns.length !== expectedColumns.length) {
    throw new Error(`${label}: transmit_logs column count drifted`);
  }
  for (const [index, expected] of expectedColumns.entries()) {
    const actual = columns[index];
    if (
      actual?.name !== expected.name
      || actual.type?.toUpperCase() !== expected.type
      || actual.notnull !== expected.notnull
      || actual.dflt_value !== expected.defaultValue
      || actual.pk !== expected.pk
    ) {
      throw new Error(`${label}: transmit_logs column contract drifted at ${expected.name}`);
    }
  }

  const primaryKeyIndex = indexListResult.results.find((index) => index.origin === 'pk');
  if (!primaryKeyIndex || primaryKeyIndex.unique !== 1) {
    throw new Error(`${label}: transmit_logs primary key index drifted`);
  }
}

function assertSharedDatabaseContracts(persistTo, label) {
  const results = execute(persistTo, `
    PRAGMA index_info('access_requests_event_email_idx');
    PRAGMA index_info('signal_email_idx');
    PRAGMA foreign_key_check;
  `);
  if (results[0].results.map((row) => row.name).join(',') !== 'event_id,email') {
    throw new Error(`${label}: access request unique index columns drifted`);
  }
  if (results[1].results.map((row) => row.name).join(',') !== 'email') {
    throw new Error(`${label}: Signal unique index columns drifted`);
  }
  if (results[2].results.length !== 0) {
    throw new Error(`${label}: foreign key check failed`);
  }
}

function prepareLegacyDatabase(persistTo) {
  execute(persistTo, legacyMigrationsSql);
}

try {
  wrangler(
    'd1', 'migrations', 'apply', 'terminal-db',
    '--local', '--persist-to', freshPersistTo,
  );
  const results = execute(freshPersistTo,
    "SELECT name, type FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name; SELECT COUNT(*) AS count FROM d1_migrations; PRAGMA foreign_key_check; PRAGMA index_info('access_requests_event_email_idx'); PRAGMA index_info('signal_email_idx');",
  );
  const objects = new Set(results[0].results.map((row) => row.name));
  for (const name of ['events', 'artists', 'access_requests', 'signal', 'transmit_logs', 'access_requests_event_email_idx', 'signal_email_idx']) {
    if (!objects.has(name)) throw new Error(`missing D1 object: ${name}`);
  }
  if (results[1].results[0]?.count !== 11) throw new Error('expected all 11 Wrangler migrations');
  if (results[2].results.length !== 0) throw new Error('foreign key check failed');
  if (results[3].results.map((row) => row.name).join(',') !== 'event_id,email') {
    throw new Error('access request unique index columns drifted');
  }
  if (results[4].results.map((row) => row.name).join(',') !== 'email') {
    throw new Error('Signal unique index columns drifted');
  }
  assertFinalTransmitSchema(freshPersistTo, 'fresh migrations');

  execute(freshPersistTo, `
    INSERT INTO events (id, data) VALUES ('event-test', '{}');
    INSERT INTO artists (id, event_id, data) VALUES ('artist-test', 'event-test', '{}');

    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-no-marketing', 'event-test', 'artist-test', NULL, 'Guest',
      'no@example.com', '@no', 1, 0, '2026-08-23T00:00:00.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'no' OR (email IS NOT NULL AND email = 'no@example.com'))
    )
    AND (
      1 IS NULL
      OR (SELECT COUNT(*) FROM access_requests
          WHERE event_id = 'event-test' AND artist_id = 'artist-test') < 1
    )
    ON CONFLICT DO NOTHING;
    INSERT INTO signal (id, name, email, instagram, source, created_at)
    SELECT 'sig-no-marketing', 'Guest', 'no@example.com', '@no', 'gate',
           '2026-08-23T00:00:00.000Z'
    WHERE 0 = 1
      AND EXISTS (SELECT 1 FROM access_requests WHERE id = 'req-no-marketing')
    ON CONFLICT(email) DO NOTHING;

    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-capacity', 'event-test', 'artist-test', NULL, 'Guest',
      'capacity@example.com', '@capacity', 1, 1, '2026-08-23T00:01:00.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'capacity' OR (email IS NOT NULL AND email = 'capacity@example.com'))
    )
    AND (
      1 IS NULL
      OR (SELECT COUNT(*) FROM access_requests
          WHERE event_id = 'event-test' AND artist_id = 'artist-test') < 1
    )
    ON CONFLICT DO NOTHING;
    INSERT INTO signal (id, name, email, instagram, source, created_at)
    SELECT 'sig-capacity', 'Guest', 'capacity@example.com', '@capacity', 'gate',
           '2026-08-23T00:01:00.000Z'
    WHERE 1 = 1
      AND EXISTS (SELECT 1 FROM access_requests WHERE id = 'req-capacity')
    ON CONFLICT(email) DO NOTHING;

    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-marketing', 'event-test', NULL, NULL, 'Guest',
      'yes@example.com', '@yes', 1, 1, '2026-08-23T00:02:00.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'yes' OR (email IS NOT NULL AND email = 'yes@example.com'))
    )
    AND NULL IS NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO signal (id, name, email, instagram, source, created_at)
    SELECT 'sig-marketing', 'Guest', 'yes@example.com', '@yes', 'gate',
           '2026-08-23T00:02:00.000Z'
    WHERE 1 = 1
      AND EXISTS (SELECT 1 FROM access_requests WHERE id = 'req-marketing')
    ON CONFLICT(email) DO NOTHING;

    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-duplicate', 'event-test', NULL, NULL, 'Guest',
      'yes@example.com', '@yes', 1, 1, '2026-08-23T00:03:00.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'yes' OR (email IS NOT NULL AND email = 'yes@example.com'))
    )
    AND NULL IS NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO signal (id, name, email, instagram, source, created_at)
    SELECT 'sig-duplicate', 'Guest', 'yes@example.com', '@yes', 'gate',
           '2026-08-23T00:03:00.000Z'
    WHERE 1 = 1
      AND EXISTS (SELECT 1 FROM access_requests WHERE id = 'req-duplicate')
    ON CONFLICT(email) DO NOTHING;

    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-no-email', 'event-test', NULL, NULL, 'Guest',
      NULL, '@NoEmail', 1, 0, '2026-08-23T00:03:30.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'noemail' OR (email IS NOT NULL AND email = NULL))
    )
    AND NULL IS NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO access_requests (
      id, event_id, artist_id, invited_by, name, email, instagram,
      privacy_consent, marketing_consent, created_at
    )
    SELECT
      'req-instagram-duplicate', 'event-test', NULL, NULL, 'Guest',
      'other@example.com', 'noemail', 1, 1, '2026-08-23T00:03:40.000Z'
    WHERE NOT EXISTS (
      SELECT 1 FROM access_requests
      WHERE event_id = 'event-test'
        AND (lower(ltrim(instagram, '@')) = 'noemail' OR (email IS NOT NULL AND email = 'other@example.com'))
    )
    AND NULL IS NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO signal (id, name, email, instagram, source, created_at)
    VALUES ('sig-direct', NULL, 'direct@example.com', '@direct', 'signal',
            '2026-08-23T00:04:00.000Z')
    ON CONFLICT(email) DO NOTHING;
    INSERT INTO signal (id, name, email, instagram, source, created_at)
    VALUES ('sig-direct-duplicate', NULL, 'direct@example.com', '@changed', 'signal',
            '2026-08-23T00:05:00.000Z')
    ON CONFLICT(email) DO NOTHING;

    INSERT INTO transmit_logs (id, handle, message, ts, created_at)
    VALUES ('tx-current', 'CURRENT', 'original', '2026.08.24 / 01:05',
            '2026-08-23T16:05:00.000Z');
    INSERT INTO transmit_logs (id, handle, message, ts, created_at)
    VALUES ('tx-older', 'OLDER', 'earlier', '2026.08.11 / 12:00',
            '2026-08-11T03:00:00.000Z');
    INSERT INTO transmit_logs (id, handle, message, ts, created_at)
    VALUES ('tx-current', 'CURRENT', 'changed', '2026.08.24 / 01:05',
            '2026-08-23T16:05:00.000Z')
    ON CONFLICT(id) DO NOTHING;
  `);

  const behavior = execute(freshPersistTo, `
    SELECT
      COUNT(*) AS total,
      SUM(id = 'req-capacity') AS capacity_inserted,
      SUM(id = 'req-duplicate') AS duplicate_inserted,
      SUM(id = 'req-no-email' AND email IS NULL) AS no_email_inserted,
      SUM(id = 'req-instagram-duplicate') AS instagram_duplicate_inserted
    FROM access_requests WHERE event_id = 'event-test';
    SELECT
      COUNT(*) AS total,
      SUM(email = 'no@example.com') AS no_marketing_inserted,
      SUM(email = 'capacity@example.com') AS rejected_request_inserted,
      SUM(email = 'yes@example.com') AS gate_marketing_inserted,
      SUM(email = 'direct@example.com') AS direct_inserted
    FROM signal;
    SELECT COUNT(*) AS total, MAX(message) AS message
    FROM transmit_logs WHERE id = 'tx-current';
    SELECT id FROM transmit_logs ORDER BY created_at DESC LIMIT 1;
    SELECT
      COUNT(*) AS total,
      SUM(typeof(created_at) <> 'text') AS non_text,
      SUM(created_at IS NULL) AS null_created_at,
      SUM(
        length(created_at) <> 24
        OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at) <> created_at
      ) AS non_canonical
    FROM transmit_logs;
    PRAGMA foreign_key_check;
  `);
  const accessResult = behavior[0].results[0];
  if (
    accessResult?.total !== 3
    || accessResult.capacity_inserted !== 0
    || accessResult.duplicate_inserted !== 0
    || accessResult.no_email_inserted !== 1
    || accessResult.instagram_duplicate_inserted !== 0
  ) {
    throw new Error('Gate atomic insert behavior drifted');
  }
  const signalResult = behavior[1].results[0];
  if (
    signalResult?.total !== 2
    || signalResult.no_marketing_inserted !== 0
    || signalResult.rejected_request_inserted !== 0
    || signalResult.gate_marketing_inserted !== 1
    || signalResult.direct_inserted !== 1
  ) {
    throw new Error('Signal insert behavior drifted');
  }
  if (behavior[2].results[0]?.total !== 1 || behavior[2].results[0]?.message !== 'original') {
    throw new Error('Transmit idempotency boundary drifted');
  }
  if (behavior[3].results[0]?.id !== 'tx-current') {
    throw new Error('Transmit canonical timestamp ordering drifted');
  }
  const canonicalResult = behavior[4].results[0];
  if (
    canonicalResult?.total !== 2
    || canonicalResult.non_text !== 0
    || canonicalResult.null_created_at !== 0
    || canonicalResult.non_canonical !== 0
  ) {
    throw new Error('Transmit canonical timestamp storage drifted');
  }
  if (behavior[5].results.length !== 0) throw new Error('behavior foreign key check failed');

  prepareLegacyDatabase(legacyPersistTo);
  const legacyBefore = execute(legacyPersistTo, `
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-canonical', 'CANONICAL', 'canonical', '2026.08.24 / 01:05',
            '2026-08-23T16:05:00.123Z', NULL);
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-int-sec', 'INT_SEC', 'integer seconds', '2026.08.11 / 12:00',
            1786417200, 'legacy-device');
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-real-sec', 'REAL_SEC', 'real seconds', '2026.08.11 / 12:00',
            1786417200.25, NULL);
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-int-ms', 'INT_MS', 'integer milliseconds', '2026.08.11 / 12:00',
            1786417200123, NULL);
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-real-ms', 'REAL_MS', 'real milliseconds', '2026.08.11 / 12:00',
            1786417200123.5, NULL);
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-null', 'NULL_TS', 'null fallback', '2026.08.24 / 01:05',
            NULL, NULL);
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT id) AS distinct_ids,
      SUM(device_id IS NOT NULL) AS device_ids
    FROM transmit_logs;
  `).at(-1).results[0];
  executeFile(legacyPersistTo, normalizeTransmitMigration);
  execute(legacyPersistTo, `
    INSERT INTO events (id, data) VALUES ('event-legacy', '{}');
    INSERT INTO artists (id, event_id, data) VALUES ('artist-legacy', 'event-legacy', '{}');
    INSERT INTO access_requests (
      id, event_id, name, email, instagram, privacy_consent, created_at,
      marketing_consent, artist_id, invited_by
    )
    VALUES ('req-legacy', 'event-legacy', 'Guest', 'legacy@example.com', '@legacy', 1,
            '2026-08-23T00:00:00.000Z', 1, 'artist-legacy', 'Artist');
  `);
  executeFile(legacyPersistTo, optionalEmailMigration);
  assertFinalTransmitSchema(legacyPersistTo, 'legacy migration');
  assertSharedDatabaseContracts(legacyPersistTo, 'legacy migration');
  const [legacyRequest, legacyEmailColumn] = execute(legacyPersistTo, `
    SELECT id, event_id, name, email, instagram, privacy_consent, marketing_consent,
           artist_id, invited_by, created_at
    FROM access_requests;
    SELECT "notnull" AS required FROM pragma_table_info('access_requests') WHERE name = 'email';
  `);
  if (JSON.stringify(legacyRequest.results) !== JSON.stringify([{
    id: 'req-legacy', event_id: 'event-legacy', name: 'Guest', email: 'legacy@example.com',
    instagram: '@legacy', privacy_consent: 1, marketing_consent: 1,
    artist_id: 'artist-legacy', invited_by: 'Artist', created_at: '2026-08-23T00:00:00.000Z',
  }])) {
    throw new Error('optional email migration did not keep existing access requests');
  }
  if (legacyEmailColumn.results[0]?.required !== 0) {
    throw new Error('optional email migration left access_requests.email required');
  }

  const migrated = execute(legacyPersistTo, `
    SELECT id, handle, message, ts, created_at, device_id
    FROM transmit_logs ORDER BY id;
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT id) AS distinct_ids,
      SUM(device_id IS NOT NULL) AS device_ids,
      SUM(typeof(created_at) <> 'text') AS non_text,
      SUM(created_at IS NULL) AS null_created_at
    FROM transmit_logs;
  `);
  const expectedRows = [
    { id: 'tx-canonical', handle: 'CANONICAL', message: 'canonical', ts: '2026.08.24 / 01:05', created_at: '2026-08-23T16:05:00.123Z', device_id: null },
    { id: 'tx-int-ms', handle: 'INT_MS', message: 'integer milliseconds', ts: '2026.08.11 / 12:00', created_at: '2026-08-11T03:00:00.123Z', device_id: null },
    { id: 'tx-int-sec', handle: 'INT_SEC', message: 'integer seconds', ts: '2026.08.11 / 12:00', created_at: '2026-08-11T03:00:00.000Z', device_id: 'legacy-device' },
    { id: 'tx-null', handle: 'NULL_TS', message: 'null fallback', ts: '2026.08.24 / 01:05', created_at: '2026-08-23T16:05:00.000Z', device_id: null },
    { id: 'tx-real-ms', handle: 'REAL_MS', message: 'real milliseconds', ts: '2026.08.11 / 12:00', created_at: '2026-08-11T03:00:00.124Z', device_id: null },
    { id: 'tx-real-sec', handle: 'REAL_SEC', message: 'real seconds', ts: '2026.08.11 / 12:00', created_at: '2026-08-11T03:00:00.250Z', device_id: null },
  ];
  if (JSON.stringify(migrated[0].results) !== JSON.stringify(expectedRows)) {
    throw new Error('legacy transmit row conversion or value preservation drifted');
  }
  const migratedCounts = migrated[1].results[0];
  if (
    legacyBefore?.total !== 6
    || legacyBefore.distinct_ids !== 6
    || legacyBefore.device_ids !== 1
    || migratedCounts?.total !== legacyBefore.total
    || migratedCounts.distinct_ids !== legacyBefore.distinct_ids
    || migratedCounts.device_ids !== legacyBefore.device_ids
    || migratedCounts.non_text !== 0
    || migratedCounts.null_created_at !== 0
  ) {
    throw new Error('legacy transmit row count or storage contract drifted');
  }

  execute(legacyPersistTo, `
    INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id)
    VALUES ('tx-int-sec', 'CHANGED', 'changed', '2026.08.11 / 12:00',
            '2026-08-11T03:00:00.000Z', NULL)
    ON CONFLICT(id) DO NOTHING;
  `);
  const idempotentRow = execute(
    legacyPersistTo,
    "SELECT handle, message, device_id FROM transmit_logs WHERE id = 'tx-int-sec';",
  )[0].results[0];
  if (
    idempotentRow?.handle !== 'INT_SEC'
    || idempotentRow.message !== 'integer seconds'
    || idempotentRow.device_id !== 'legacy-device'
  ) {
    throw new Error('migrated transmit primary key idempotency drifted');
  }

  prepareLegacyDatabase(invalidPersistTo);
  execute(invalidPersistTo, `
    INSERT INTO transmit_logs (id, handle, message, ts, created_at)
    VALUES ('tx-unknown', 'UNKNOWN', 'unknown timestamp', '2026.08.24 / 01:05',
            '2026-08-24T01:05:00+09:00');
  `);
  let rejectedUnknownTimestamp = false;
  try {
    executeFile(invalidPersistTo, normalizeTransmitMigration);
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    rejectedUnknownTimestamp = /NOT NULL constraint failed.*created_at/i.test(output);
  }
  if (!rejectedUnknownTimestamp) {
    throw new Error('unknown transmit timestamp did not fail closed');
  }

  console.log('Local D1 contract PASS: 11 migrations, canonical Transmit schema/data conversion, optional guest email, indexes, FK, Gate/Signal atomic rules, Transmit idempotency/order');
} finally {
  for (const persistTo of persistRoots) {
    rmSync(persistTo, { recursive: true, force: true });
  }
}
