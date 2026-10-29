import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Sends one mail to everyone on the Signal list (production D1 `signal`), one message per address.
 *
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>"            (dry run)
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>" --only <address>
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>" --send
 *
 * Without --send or --only it only prints how many would receive it. Mail goes out through
 * Cloudflare Email Sending from terminal@terminal.stann.kr, replies go to REPLY_TO, and every
 * message carries a List-Unsubscribe header that answers by mail. Sending uses the wrangler OAuth
 * login (the API token in .env has no Email Sending permission), so the repo .env is not loaded for
 * it. Each sent address is appended to backups/signal-mail/<date>.log (git-ignored), and a re-run
 * of the same log skips those addresses.
 */
const DATABASE = 'terminal-db';
const FROM = 'terminal@terminal.stann.kr';
const REPLY_TO = 'ilsny7@gmail.com';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Addresses that cannot be delivered (a misspelt domain); left out rather than bounced.
const UNDELIVERABLE = /@(gamil|gmial|gmai|naver\.co)\.(com|kr)$|@gmail\.co$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const [htmlFile, textFile] = args.filter((arg, index) => !arg.startsWith('--') && !['--subject', '--only', '--log'].includes(args[index - 1]));
const subject = option('--subject');
const only = option('--only');
const send = args.includes('--send');
if (!htmlFile || !textFile || !subject) fail('usage: <mail.html> <mail.txt> --subject "<subject>" [--only <address> | --send]');
if (only && send) fail('--only and --send are separate runs');
const html = readFileSync(htmlFile, 'utf8');
const text = readFileSync(textFile, 'utf8');

const wrangler = (rest, { oauth = false } = {}) => {
  const env = { ...process.env, NO_COLOR: '1' };
  const extra = [];
  if (oauth) {
    delete env.CLOUDFLARE_API_TOKEN;
    const empty = path.join(mkdtempSync(path.join(tmpdir(), 'signal-mail-')), 'empty.env');
    writeFileSync(empty, '');
    extra.push('--env-file', empty);
  }
  return execFileSync('npx', ['wrangler', ...rest, ...extra], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
};

function subscribers() {
  const out = wrangler(['d1', 'execute', DATABASE, '--env', 'production', '--remote', '--json', '--command', 'SELECT DISTINCT lower(trim(email)) AS email FROM signal']);
  const rows = JSON.parse(out.slice(out.indexOf('[')))[0].results.map(row => row.email);
  return { valid: rows.filter(email => EMAIL.test(email) && !UNDELIVERABLE.test(email)), skipped: rows.filter(email => !EMAIL.test(email) || UNDELIVERABLE.test(email)) };
}

function sendTo(address) {
  wrangler(['email', 'sending', 'send',
    '--from', FROM, '--from-name', 'TERMINAL', '--reply-to', REPLY_TO, '--reply-to-name', 'Stann',
    '--to', address, '--subject', subject, '--html', html, '--text', text,
    '--header', `List-Unsubscribe:<mailto:${REPLY_TO}?subject=unsubscribe>`], { oauth: true });
}

if (only) {
  sendTo(only);
  console.log(`✓ sent to ${only}`);
  process.exit(0);
}

const { valid, skipped } = subscribers();
const logDir = path.join(process.cwd(), 'backups', 'signal-mail');
const logFile = option('--log') ?? path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
let done = new Set();
try { done = new Set(readFileSync(logFile, 'utf8').split('\n').filter(Boolean)); } catch {}
const pending = valid.filter(email => !done.has(email));
console.log(`${valid.length} subscribers, ${skipped.length} undeliverable left out, ${valid.length - pending.length} already sent in ${path.relative(process.cwd(), logFile)}`);
if (!send) {
  console.log(`dry run: ${pending.length} would receive "${subject}". Add --send to send.`);
  process.exit(0);
}
mkdirSync(path.dirname(logFile), { recursive: true });
let failed = 0;
for (const [index, address] of pending.entries()) {
  try {
    sendTo(address);
    appendFileSync(logFile, `${address}\n`);
    console.log(`✓ ${index + 1}/${pending.length}`);
  } catch (error) {
    failed += 1;
    console.error(`✖ ${index + 1}/${pending.length}: ${String(error.stderr ?? error.message).split('\n').find(line => /error/i.test(line)) ?? 'failed'}`);
  }
}
console.log(`${pending.length - failed} sent, ${failed} failed`);
process.exit(failed ? 1 : 0);
