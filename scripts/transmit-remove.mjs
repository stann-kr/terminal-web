import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { failureReason, parseWranglerJson } from './lib/cli.mjs';
import { DATABASE, ID, USAGE, COLUMNS, backupMismatch, parseArgs, restoreSql, writeDecision } from './lib/transmitRemove.mjs';

/**
 * Takes a visitor-log post down from the public log, and puts it back.
 *
 *   npm run transmit:remove -- list [count] [--remote]
 *   npm run transmit:remove -- remove <id> [--remote --confirm <id>]
 *   npm run transmit:remove -- restore <backup.json> [--remote --confirm <post id>]
 *
 * Without --remote it works on the local D1 simulation (`--persist-to <dir>` picks another one);
 * --remote is the live database, and there a remove or restore only prints what it would do unless
 * --confirm names the post id. A post is written to backups/transmit/ (git-ignored) before it is
 * deleted, and `restore` inserts that backup again, so a take-down can be undone exactly; a backup
 * goes back only to the place (live or local) it was taken from.
 */
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'transmit');

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
process.on('uncaughtException', error => fail(failureReason(error)));

const { command, target, remote, persistTo, confirm, error } = parseArgs(process.argv.slice(2));
if (error) fail(`${error}\n${USAGE}`);
const where = remote ? ['--remote'] : ['--local', ...(persistTo ? ['--persist-to', persistTo] : [])];
const place = remote ? 'live' : 'local';

const wrangler = (...rest) => execFileSync('npx', ['wrangler', ...rest], {
  cwd: process.cwd(),
  env: { ...process.env, NO_COLOR: '1' },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 16 * 1024 * 1024,
});
/** The rows of the statement run; wrangler prints a JSON array with a result per statement. */
const query = (sql) => parseWranglerJson(wrangler('d1', 'execute', DATABASE, ...where, '--json', '--command', sql)).flatMap((result) => result.results ?? []);
const exists = (id) => query(`SELECT id FROM transmit_logs WHERE id = '${id}'`).length > 0;
const relative = (file) => path.relative(process.cwd(), file);

function list(count) {
  const limit = Number.isInteger(Number(count)) && Number(count) > 0 ? Math.min(Number(count), 200) : 20;
  const latest = query(`SELECT id, handle, ts, message FROM transmit_logs ORDER BY created_at DESC LIMIT ${limit}`);
  for (const row of latest) console.log(`${row.id}\t${row.ts}\t${row.handle}\t${String(row.message).replace(/\s+/g, ' ').slice(0, 80)}`);
  console.log(`${latest.length} posts (${place})`);
}

function remove(id) {
  if (!id || !ID.test(id)) fail('remove needs a post id (see `list`)');
  const [row] = query(`SELECT ${COLUMNS.join(', ')} FROM transmit_logs WHERE id = '${id}'`);
  if (!row) fail(`no post ${id} in the ${place} log`);
  const decision = writeDecision({ action: 'remove', id, remote, confirm });
  if (!decision.write) {
    console.log(`${row.id}\t${row.ts}\t${row.handle}\t${String(row.message).replace(/\s+/g, ' ').slice(0, 80)}`);
    console.log(decision.plan);
    process.exit(0);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.json`);
  writeFileSync(backup, `${JSON.stringify({ database: DATABASE, remote, row }, null, 2)}\n`);
  const undo = `npm run transmit:remove -- restore ${relative(backup)}${remote ? ` --remote --confirm ${id}` : ''}`;
  // From here on the post may be gone even if a later step fails: every failure names the backup.
  let stillThere;
  try {
    query(`DELETE FROM transmit_logs WHERE id = '${id}'`);
    stillThere = exists(id);
  } catch (failure) {
    fail(`${failureReason(failure)} — the delete may have been applied; check with list, the backup is ${relative(backup)} (undo: ${undo})`);
  }
  if (stillThere) fail(`${id} is still there; the backup is ${relative(backup)}`);
  console.log(`✓ took ${id} down (${row.handle}: ${String(row.message).slice(0, 60)})`);
  console.log(`  backup ${relative(backup)} — undo with: ${undo}`);
}

function restore(file) {
  if (!file) fail('restore needs a backup file');
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  const mismatch = backupMismatch(backup, { remote });
  if (mismatch) fail(`${file}: ${mismatch}`);
  const { row } = backup;
  if (exists(row.id)) fail(`${row.id} is already in the ${place} log`);
  const decision = writeDecision({ action: 'restore', id: row.id, remote, confirm, backup: file });
  if (!decision.write) {
    console.log(decision.plan);
    process.exit(0);
  }
  // The message can hold any text, so it goes in a file rather than on the command line.
  const dir = mkdtempSync(path.join(tmpdir(), 'transmit-restore-'));
  let back;
  let failure;
  try {
    const sql = path.join(dir, 'restore.sql');
    writeFileSync(sql, restoreSql(row));
    wrangler('d1', 'execute', DATABASE, ...where, '--json', '--file', sql);
    back = exists(row.id);
  } catch (caught) {
    failure = caught;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (failure) fail(`${failureReason(failure)} — the insert may have been applied; check with list before running restore again`);
  if (!back) fail(`${row.id} did not come back`);
  console.log(`✓ restored ${row.id} to the ${place} log`);
}

if (command === 'list') list(target);
else if (command === 'remove') remove(target);
else if (command === 'restore') restore(target);
else fail(USAGE);
