import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseWranglerJson } from './lib/cli.mjs';
import { readSentLog } from './lib/signalMail.mjs';

/**
 * Prints each Signal mail's totals (production D1 `mail_stats`, see lib/mail/stats): the open
 * pixel's loads and each link's presses, with the subject and the number sent from the mail's send
 * log (backups/signal-mail/<key>.log).
 *
 *   npm run signal:stats            every mail that has counts
 *   npm run signal:stats -- <key>   one mail, by day
 *
 * The counts are loads, not people: Gmail's image proxy may load a mail's pixel once or several
 * times, Apple Mail may load it unopened, link scanners may press links, and images turned off
 * load nothing.
 */
const key = process.argv[2];
if (key && !/^[0-9a-f]{16}$/.test(key)) {
  console.error('✖ the mail key is the 16-character name of its send log');
  process.exit(1);
}
const LOGS = path.join(process.cwd(), 'backups', 'signal-mail');

function query(sql) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'terminal-db', '--env', 'production', '--remote', '--json', '--command', sql],
    { env: { ...process.env, NO_COLOR: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return parseWranglerJson(out)[0]?.results ?? [];
}
/** The subject and how many were sent, from the mail's send log (none when the log is elsewhere). */
function sendLog(mail) {
  try {
    const content = readFileSync(path.join(LOGS, `${mail}.log`), 'utf8');
    return { subject: content.match(/^# \S+ (.*)$/m)?.[1] ?? '', sent: readSentLog(content).size };
  } catch {
    return { subject: '(no send log here)', sent: null };
  }
}

const rows = query(key
  ? `SELECT mail_key, day, kind, target, count FROM mail_stats WHERE mail_key = '${key}' ORDER BY day, kind, count DESC`
  : 'SELECT mail_key, kind, target, SUM(count) AS count, MIN(day) AS first, MAX(day) AS last FROM mail_stats GROUP BY 1, 2, 3 ORDER BY first DESC, mail_key, kind DESC, count DESC');
if (!rows.length) {
  console.log(key ? `no counts for ${key}` : 'no counts yet');
  if (!key) console.log(`send logs: ${readdirSync(LOGS).filter((name) => name.endsWith('.log')).length}`);
  process.exit(0);
}
const byMail = Map.groupBy(rows, (row) => row.mail_key);
for (const [mail, list] of byMail) {
  const { subject, sent } = sendLog(mail);
  const opens = list.filter((row) => row.kind === 'open').reduce((sum, row) => sum + row.count, 0);
  const clicks = list.filter((row) => row.kind === 'click').reduce((sum, row) => sum + row.count, 0);
  console.log(`\n${mail}  ${subject}`);
  console.log(`  sent ${sent ?? '?'} · opens ${opens} · clicks ${clicks}`);
  for (const row of list) {
    const when = key ? row.day : `${row.first}${row.last !== row.first ? `…${row.last}` : ''}`;
    console.log(`  ${when}  ${row.kind.padEnd(5)} ${String(row.count).padStart(4)}  ${row.target}`);
  }
}
