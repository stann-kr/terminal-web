import { execFileSync } from 'node:child_process';
import { AUTHON_SYNC_ROW_COLUMNS, buildAuthonGuestPayload, classifyAuthonReply } from '../lib/authon/syncPayload.mjs';
import { failureReason, parseWranglerJson, readEnvValue } from './lib/cli.mjs';

/**
 * Sends an event's listed guests to the FAUST door list (authon) again: the catch-up for guests the
 * live copy missed (authon was down, or the venue had not made its event for the night yet). authon
 * keys each guest by its terminal request id, so guests already there come back unchanged and
 * nobody is listed twice. Waitlisted guests are not sent until they are moved up.
 *
 *   npm run authon:sync -- <eventId>                      what would be sent (live terminal list, read only)
 *   npm run authon:sync -- <eventId> --confirm <eventId>  send it
 *
 * Sending needs AUTHON_SYNC_SECRET (authon's INTERNAL_API_SECRET) in the environment or .env, and
 * goes to AUTHON_SYNC_URL (default the FAUST guest site). Output names request ids and artists only.
 */
const DEFAULT_URL = 'https://guest.faustseoul.kr/api/internal/sync-guest';
const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
process.on('uncaughtException', (error) => fail(failureReason(error)));

const args = process.argv.slice(2);
const eventId = args[0];
const confirmAt = args.indexOf('--confirm');
const confirm = confirmAt === -1 ? null : args[confirmAt + 1];
if (!eventId || !EVENT_ID.test(eventId)) fail('usage: npm run authon:sync -- <eventId> [--confirm <eventId>]');
if (confirmAt !== -1 && confirm !== eventId) fail('--confirm must repeat the event id');

const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'terminal-db', '--env', 'production', '--remote', '--json', '--command',
  `SELECT ${AUTHON_SYNC_ROW_COLUMNS} FROM access_requests r JOIN events e ON e.id = r.event_id LEFT JOIN artists a ON a.id = r.artist_id WHERE r.event_id = '${eventId}' ORDER BY r.created_at, r.id`],
{ env: { ...process.env, NO_COLOR: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const rows = parseWranglerJson(out)[0]?.results ?? [];

const payloads = [];
const unusable = [];
for (const row of rows) {
  const payload = buildAuthonGuestPayload(row);
  if (payload) payloads.push(payload);
  else unusable.push(String(row.id));
}
const byArtist = new Map();
for (const payload of payloads) {
  const artist = payload.artistName ?? '(no artist)';
  byArtist.set(artist, (byArtist.get(artist) ?? 0) + 1);
}
console.log(`${eventId}: ${payloads.length} guests to send${unusable.length ? `, ${unusable.length} unusable (${unusable.join(', ')})` : ''}`);
for (const [artist, count] of [...byArtist].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${artist}\t${count}`);

if (!confirm) {
  console.log(`nothing sent. To send: npm run authon:sync -- ${eventId} --confirm ${eventId}`);
  process.exit(0);
}

const secret = readEnvValue('AUTHON_SYNC_SECRET');
if (!secret) fail('AUTHON_SYNC_SECRET is not set (environment or .env)');
const url = readEnvValue('AUTHON_SYNC_URL') ?? DEFAULT_URL;

const tally = { synced: 0, retry: 0, rejected: 0 };
const problems = [];
for (const payload of payloads) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  const outcome = classifyAuthonReply(response.status, body);
  tally[outcome] += 1;
  if (outcome !== 'synced') problems.push(`${payload.terminalRequestId}\t${response.status}\t${body?.error ?? ''}`);
  // A refused secret fails every guest the same way: stop at the first.
  if (response.status === 401) break;
}
for (const line of problems) console.log(`  ✖ ${line}`);
console.log(`sent: ${tally.synced} in authon, ${tally.retry} to retry later, ${tally.rejected} refused`);
if (problems.length) process.exit(1);
