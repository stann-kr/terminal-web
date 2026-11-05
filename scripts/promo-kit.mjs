import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Manages the promo files artists take from their host pages (lib/gate/promoKit). The files and
 * the list of them both live in the private R2 bucket, so nothing here needs a code deploy.
 *
 *   npm run kit -- list --event TRM-03
 *   npm run kit -- put --event TRM-03 --as main_story --label '본 포스터 · 스토리' --file <png>
 *   npm run kit -- put --event TRM-03 --artist 03-F --as harim_back --label '아티스트 포스터 · 뒷면' --file <png>
 *   npm run kit -- remove --event TRM-03 --as timetable
 *
 * `put` replaces the entry saved under the same name (`--as`, saved as TERMINAL[03]_<as>.png) in
 * place, or adds it at the end (or `--after <as>`). It uploads the PNG under a content-hashed key
 * with a 480px JPEG preview (macOS `sips`). Without --confirm 1 every command only prints what it
 * would do; with it, the old manifest is kept as kit/history/<event>.<time>.json before the write.
 * Replaced files stay in the bucket, unlisted. A new event's first `put` needs --init.
 */
const BUCKET = 'terminal-press';
const EVENT_ID = /^[A-Z0-9-]{1,32}$/;
const ARTIST_ID = /^[A-Za-z0-9-]{1,64}$/;
const BASE = /^[a-z0-9_]{1,64}$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
const reason = error => String(error?.stderr || error?.message || error).split('\n').find(line => /error|✘/i.test(line))?.trim() ?? String(error?.message ?? error);
process.on('uncaughtException', error => fail(reason(error)));

const [command, ...args] = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const eventId = option('--event');
const artistId = option('--artist');
const base = option('--as');
const confirm = option('--confirm') === '1';
if (!['list', 'put', 'remove'].includes(command) || !eventId || !EVENT_ID.test(eventId)) {
  fail('usage: list|put|remove --event <event id> [--artist <artist id>] [--as <name>] [--label <label>] [--file <png>] [--after <name>] [--confirm 1]');
}
if (artistId && !ARTIST_ID.test(artistId)) fail(`bad artist id ${artistId}`);

const work = mkdtempSync(path.join(tmpdir(), 'promo-kit-'));
process.on('exit', () => rmSync(work, { recursive: true, force: true }));
const wrangler = (...rest) => execFileSync('npx', ['wrangler', 'r2', 'object', ...rest, '--remote'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
const put = (key, file, type) => wrangler('put', `${BUCKET}/${key}`, '--file', file, '--content-type', type);

const manifestKey = `kit/${eventId}.json`;
const readManifest = () => {
  const file = path.join(work, 'manifest.json');
  try {
    wrangler('get', `${BUCKET}/${manifestKey}`, '--file', file);
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

// An unreadable manifest is never taken for a missing one: only --init starts an event's list.
const manifest = readManifest() ?? (args.includes('--init') ? { dir: eventId.toLowerCase(), artists: {}, event: [] } : fail(`cannot read ${manifestKey} (a new event needs --init)`));
const number = eventId.match(/(\d+)$/)?.[1] ?? eventId;
const downloadFor = name => `TERMINAL[${number}]_${name}.png`;
const listOf = () => (artistId ? (manifest.artists[artistId] ??= []) : manifest.event);
const mb = bytes => `${(bytes / 1_048_576).toFixed(1)} MB`;

if (command === 'list') {
  const show = (title, list) => {
    console.log(title);
    for (const item of list) console.log(`  ${item.download.padEnd(36)} ${item.label} · ${item.width}×${item.height} · ${mb(item.bytes)}  (${item.name})`);
  };
  for (const [id, list] of Object.entries(manifest.artists)) show(id, list);
  show('event', manifest.event);
  process.exit(0);
}

if (!base || !BASE.test(base)) fail('--as <name> (a-z, 0-9, _), saved as TERMINAL[..]_<name>.png');
const list = listOf();
const at = list.findIndex(item => item.download === downloadFor(base));

if (command === 'remove') {
  if (at < 0) fail(`${downloadFor(base)} is not listed${artistId ? ` for ${artistId}` : ' for the event'}`);
  console.log(`− ${list[at].download} (${list[at].label})`);
  list.splice(at, 1);
} else {
  const source = option('--file');
  const label = option('--label') ?? list[at]?.label;
  if (!source) fail('--file <png>');
  if (!label) fail('--label <label> (needed for a new entry)');
  const bytes = readFileSync(source);
  if (bytes.subarray(1, 4).toString() !== 'PNG') fail(`${source} is not a PNG`);
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], { encoding: 'utf8' });
  const [width, height] = ['pixelWidth', 'pixelHeight'].map(key => Number(size.match(new RegExp(`${key}: (\\d+)`))?.[1]));
  const name = `${base.replaceAll('_', '-')}.${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`;
  const entry = { label, name, download: downloadFor(base), width, height, bytes: bytes.length };
  if (at >= 0) {
    console.log(`~ ${entry.download}: ${list[at].name} → ${name} · ${width}×${height} · ${mb(bytes.length)}`);
    list[at] = entry;
  } else {
    const after = option('--after');
    const index = after ? list.findIndex(item => item.download === downloadFor(after)) : -1;
    if (after && index < 0) fail(`--after ${after} is not listed`);
    console.log(`+ ${entry.download} (${label}) · ${width}×${height} · ${mb(bytes.length)}`);
    list.splice(index >= 0 ? index + 1 : list.length, 0, entry);
  }
  if (confirm) {
    const thumb = path.join(work, `${name}.thumb.jpg`);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '480', source, '--out', thumb], { stdio: 'ignore' });
    put(`${manifest.dir}/${name}.png`, source, 'image/png');
    put(`${manifest.dir}/${name}.thumb.jpg`, thumb, 'image/jpeg');
  }
}

if (!confirm) {
  console.log('(dry run: add --confirm 1 to write)');
  process.exit(0);
}
const previous = path.join(work, 'manifest.json');
try {
  readFileSync(previous);
  put(`kit/history/${eventId}.${new Date().toISOString().replaceAll(':', '-')}.json`, previous, 'application/json');
} catch { /* the first manifest of this event */ }
const next = path.join(work, 'next.json');
writeFileSync(next, `${JSON.stringify(manifest, null, 2)}\n`);
put(manifestKey, next, 'application/json');
console.log(`✓ ${manifestKey} written; the host pages show it on their next load.`);
