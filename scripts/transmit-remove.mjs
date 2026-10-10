import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Takes a visitor-log post down from the public log, and puts it back.
 *
 *   npm run transmit:remove -- list [count] [--remote]
 *   npm run transmit:remove -- remove <id> [--remote]
 *   npm run transmit:remove -- restore <backup.json> [--remote]
 *
 * Without --remote it works on the local D1 simulation (`--persist-to <dir>` picks another one);
 * --remote is the live database. A post is written to backups/transmit/ (git-ignored) before it
 * is deleted, and `restore` inserts that backup again, so a take-down can be undone exactly.
 */
const DATABASE = 'terminal-db';
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'transmit');
const ID = /^[A-Za-z0-9_-]{1,160}$/;
const COLUMNS = ['id', 'handle', 'message', 'ts', 'created_at', 'device_id'];

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const remote = args.includes('--remote');
// A local run can point at another simulation (tests use a throwaway one).
const persistAt = args.indexOf('--persist-to');
const persistTo = persistAt >= 0 ? args[persistAt + 1] : null;
const flagged = new Set(persistAt >= 0 ? [persistAt, persistAt + 1] : []);
const [command, target] = args.filter((arg, index) => arg !== '--remote' && !flagged.has(index));
if (remote && persistTo) fail('--persist-to is for the local simulation only');
const where = remote ? ['--remote'] : ['--local', ...(persistTo ? ['--persist-to', persistTo] : [])];

const wrangler = (...rest) => execFileSync('npx', ['wrangler', ...rest], {
  cwd: process.cwd(),
  env: { ...process.env, NO_COLOR: '1' },
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
/** The rows of the one statement run; wrangler prints a JSON array with a result per statement. */
const rows = (output) => JSON.parse(output).flatMap((result) => result.results ?? []);
const query = (sql) => rows(wrangler('d1', 'execute', DATABASE, ...where, '--json', '--command', sql));
/** SQL text literal: the value is quoted and its quotes doubled; NULL stays NULL. */
const literal = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);

function list(count) {
  const limit = Number.isInteger(Number(count)) && Number(count) > 0 ? Math.min(Number(count), 200) : 20;
  const latest = query(`SELECT id, handle, ts, message FROM transmit_logs ORDER BY created_at DESC LIMIT ${limit}`);
  for (const row of latest) console.log(`${row.id}\t${row.ts}\t${row.handle}\t${String(row.message).replace(/\s+/g, ' ').slice(0, 80)}`);
  console.log(`${latest.length} posts (${remote ? 'live' : 'local'})`);
}

function remove(id) {
  if (!id || !ID.test(id)) fail('remove needs a post id (see `list`)');
  const [row] = query(`SELECT ${COLUMNS.join(', ')} FROM transmit_logs WHERE id = '${id}'`);
  if (!row) fail(`no post ${id} in the ${remote ? 'live' : 'local'} log`);
  mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.json`);
  writeFileSync(backup, `${JSON.stringify({ database: DATABASE, remote, row }, null, 2)}\n`);
  query(`DELETE FROM transmit_logs WHERE id = '${id}'`);
  if (query(`SELECT id FROM transmit_logs WHERE id = '${id}'`).length) fail(`${id} is still there; the backup is ${backup}`);
  console.log(`✓ took ${id} down (${row.handle}: ${String(row.message).slice(0, 60)})`);
  console.log(`  backup ${path.relative(process.cwd(), backup)} — undo with: npm run transmit:remove -- restore ${path.relative(process.cwd(), backup)}${remote ? ' --remote' : ''}`);
}

function restore(file) {
  if (!file) fail('restore needs a backup file');
  const { row } = JSON.parse(readFileSync(file, 'utf8'));
  if (!row || !ID.test(row.id ?? '')) fail(`${file} holds no post`);
  if (query(`SELECT id FROM transmit_logs WHERE id = '${row.id}'`).length) fail(`${row.id} is already in the log`);
  // The message can hold any text, so it goes in a file rather than on the command line.
  const dir = mkdtempSync(path.join(tmpdir(), 'transmit-restore-'));
  try {
    const sql = path.join(dir, 'restore.sql');
    writeFileSync(sql, `INSERT INTO transmit_logs (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((column) => literal(row[column])).join(', ')});\n`);
    wrangler('d1', 'execute', DATABASE, ...where, '--json', '--file', sql);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (!query(`SELECT id FROM transmit_logs WHERE id = '${row.id}'`).length) fail(`${row.id} did not come back`);
  console.log(`✓ restored ${row.id} to the ${remote ? 'live' : 'local'} log`);
}

if (command === 'list') list(target);
else if (command === 'remove') remove(target);
else if (command === 'restore') restore(target);
else fail('usage: transmit:remove -- list [count] | remove <id> | restore <backup.json>  [--remote]');
