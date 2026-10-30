import { execFileSync } from 'node:child_process';
import { createHmac, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Gives an artist of the next event a guest code and prints the two links that go with it: the
 * guest invite link (what the artist hands on) and the artist's own host page link.
 *
 *   npm run invite -- --artist 03-A                       (dry run: what would change)
 *   npm run invite -- --artist 03-A --confirm 1           (write: new code, limit 10)
 *   npm run invite -- --artist 03-A --limit 15 --confirm 1
 *   npm run invite -- --artist 03-A --replace --confirm 1 (a new code; the old links stop working)
 *   npm run invite -- --artist 03-A --link [--image]      (links for the current code; no write)
 *
 * Production D1 is written only with --confirm 1, after the row is backed up to
 * .docs/evidence/<date>-invite-<artist>/ (git-ignored), with an update that applies only while the
 * row still holds the code read a moment before. A code is never changed without --replace, and
 * never repeats another artist's code in the same event (two equal codes would match neither).
 * The host link is signed with SIGNAL_UNSUBSCRIBE_SECRET (the Worker's secret; read from the
 * environment or .env), over the artist and the code. A write, or --image, also renders the
 * artist's link preview to public/og/invite/<artist>.png and lists it in
 * features/events/inviteImages.json; that needs Playwright (PLAYWRIGHT_DIR) and a deploy to show.
 */
const DATABASE = 'terminal-db';
const SITE = 'https://terminal.stann.kr';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10_000;
// No 0/O or 1/I: the code is read off a phone and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ARTIST_ID = /^[A-Za-z0-9-]{1,64}$/;
const CODE = /^[A-Z0-9]{4,12}$/;
const IMAGES = 'features/events/inviteImages.json';

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
const reason = error => String(error?.stderr || error?.message || error).split('\n').find(line => /error|✘/i.test(line))?.trim() ?? String(error?.message ?? error);
process.on('uncaughtException', error => fail(reason(error)));

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const artistId = option('--artist');
if (!artistId || !ARTIST_ID.test(artistId)) fail('usage: --artist <artist row id> [--limit N] [--code CODE] [--replace] [--link [--image]] [--confirm 1]');
const linkOnly = args.includes('--link');
const replace = args.includes('--replace');
const confirm = option('--confirm');

const d1 = command => {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DATABASE, '--env', 'production', '--remote', '--json', '--command', command],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
  return JSON.parse(out.slice(out.indexOf('[')));
};
const sql = value => `'${String(value).replaceAll("'", "''")}'`;

const [artistResult] = d1(`SELECT id, event_id, data FROM artists WHERE id = ${sql(artistId)}`);
const row = artistResult.results[0];
if (!row) fail(`no artist row ${artistId}`);
const data = JSON.parse(row.data);
const [eventResult, othersResult] = d1(`SELECT data FROM events WHERE id = ${sql(row.event_id)}; SELECT id, data FROM artists WHERE event_id = ${sql(row.event_id)} AND id <> ${sql(artistId)}`);
const event = JSON.parse(eventResult.results[0]?.data ?? 'null');
if (!event) fail(`no event ${row.event_id}`);
const taken = new Set(othersResult.results.map(other => String(JSON.parse(other.data).guestCode ?? '').trim().toUpperCase()).filter(Boolean));

const current = typeof data.guestCode === 'string' && data.guestCode.trim() ? data.guestCode.trim().toUpperCase() : null;
const requested = option('--code')?.trim().toUpperCase();
if (requested && !CODE.test(requested)) fail('--code: 4 to 12 letters or digits');
const generate = () => {
  for (;;) {
    const code = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    if (!taken.has(code)) return code;
  }
};
const code = linkOnly ? current : requested ?? (current && !replace ? current : generate());
if (!code) fail(`${artistId} has no guest code yet: run without --link`);
if (current && code !== current && !replace) fail(`${artistId} already has code ${current}; a new one needs --replace (its old links stop working)`);
if (taken.has(code)) fail(`code ${code} is another artist's in ${row.event_id}`);
const limitArg = option('--limit');
const limit = limitArg === undefined ? (Number.isSafeInteger(data.guestLimit) ? data.guestLimit : DEFAULT_LIMIT) : Number(limitArg);
if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail(`--limit: a whole number from 1 to ${MAX_LIMIT}`);

const secret = process.env.SIGNAL_UNSUBSCRIBE_SECRET
  ?? (() => { try { return readFileSync('.env', 'utf8').match(/^SIGNAL_UNSUBSCRIBE_SECRET=(.+)$/m)?.[1].trim(); } catch { return undefined; } })();
if (!secret) fail('SIGNAL_UNSUBSCRIBE_SECRET is not set (environment or .env)');
const links = () => {
  const token = createHmac('sha256', secret).update(`host:${artistId}:${code}`).digest('hex');
  console.log(`  artist  ${data.name}`);
  console.log(`  code    ${code}  (limit ${limit})`);
  console.log(`  guest   ${SITE}/events/${encodeURIComponent(row.event_id)}/request?invite=${encodeURIComponent(code)}`);
  console.log(`  host    ${SITE}/host/${encodeURIComponent(artistId)}?t=${token}`);
};

async function image() {
  const { renderOg } = await import('./og/render.mjs');
  const weekday = new Date(`${event.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const out = `public/og/invite/${artistId}.png`;
  await renderOg('scripts/og/invite.html', out, {
    ARTIST: data.name,
    NUMBER: event.session.match(/\[[^\]]+\]/)?.[0] ?? '',
    SUBTITLE: event.subtitle ?? '',
    DATE: `${event.date.replaceAll('-', '.')} ${weekday} ${String(event.time).slice(0, 5)}`,
    VENUE: event.venue ?? '',
  });
  const listed = existsSync(IMAGES) ? JSON.parse(readFileSync(IMAGES, 'utf8')) : [];
  if (!listed.includes(artistId)) writeFileSync(IMAGES, `${JSON.stringify([...listed, artistId].sort(), null, 2)}\n`);
  console.log(`✓ ${out} (commit it and deploy for the preview to show)`);
}

if (linkOnly) {
  links();
  if (args.includes('--image')) await image();
  process.exit(0);
}
if (code === current && limit === data.guestLimit) {
  console.log('nothing to change:');
  links();
  process.exit(0);
}
const plan = `${artistId} (${data.name}) code ${current ?? '-'} → ${code}, limit ${data.guestLimit ?? '-'} → ${limit}`;
if (confirm !== '1') {
  console.log(`not written: ${plan}. To write, run again with --confirm 1${requested || current ? '' : ' (a fresh code is drawn on that run)'}.`);
  process.exit(0);
}

// One folder per run: a second change the same day never overwrites the first backup.
const folder = path.join('.docs', 'evidence', `${new Date().toISOString().replace(/[:.]/g, '-')}-invite-${artistId}`);
mkdirSync(folder, { recursive: false });
writeFileSync(path.join(folder, 'before.json'), `${JSON.stringify(row, null, 2)}\n`);
const guard = current === null ? "json_extract(data, '$.guestCode') IS NULL" : `json_extract(data, '$.guestCode') = ${sql(data.guestCode)}`;
const limitGuard = Number.isSafeInteger(data.guestLimit) ? `json_extract(data, '$.guestLimit') = ${data.guestLimit}` : "json_extract(data, '$.guestLimit') IS NULL";
// The row must still hold what was read, and no other artist of the event may have taken the code
// meanwhile (two runs at once): otherwise nothing is written.
const [update] = d1(`UPDATE artists SET data = json_set(data, '$.guestCode', ${sql(code)}, '$.guestLimit', ${limit})
  WHERE id = ${sql(artistId)} AND ${guard} AND ${limitGuard}
  AND NOT EXISTS (SELECT 1 FROM artists AS other WHERE other.event_id = ${sql(row.event_id)} AND other.id <> ${sql(artistId)}
    AND upper(trim(json_extract(other.data, '$.guestCode'))) = ${sql(code)})`);
writeFileSync(path.join(folder, 'update-result.json'), `${JSON.stringify(update.meta ?? update, null, 2)}\n`);
if (update.meta?.changes !== 1) fail(`the row changed since it was read, or another artist took ${code}; nothing written (${folder})`);
const [after] = d1(`SELECT id, event_id, data FROM artists WHERE id = ${sql(artistId)}`);
writeFileSync(path.join(folder, 'after.json'), `${JSON.stringify(after.results[0], null, 2)}\n`);
const saved = JSON.parse(after.results[0].data);
if (saved.guestCode !== code || saved.guestLimit !== limit) fail(`read-back does not match (${folder})`);
console.log(`✓ written: ${plan} (backup ${folder})`);
links();
try {
  await image();
} catch (error) {
  console.log(`! preview image not rendered (${reason(error)}); run again with --link --image where Playwright is installed`);
}
