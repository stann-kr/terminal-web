import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { failureReason, parseWranglerJson, positionalArgs, readEnvValue } from './lib/cli.mjs';
import { VALUE_FLAGS, defaultLogFile, logLine, otherLogs, pendingRecipients, readSentLog, replyToAddress, sendPending } from './lib/signalMail.mjs';

/**
 * Sends one mail to everyone on the Signal list (production D1 `signal`), one message per address.
 *
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>"                        (dry run)
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>" --only <address> --confirm 1
 *   npm run signal:mail -- <mail.html> <mail.txt> --subject "<subject>" --send --confirm <count>
 *
 * Nothing is sent without --confirm naming exactly how many people will get the mail (1 for
 * --only); without it a run only prints who would. A subject shorter than 10 characters is refused,
 * and so is a subject marked TEST on a send to the whole list. --only to a subscriber (anyone but
 * the reply address) is logged like --send, so the whole-list run after it skips them. Mail goes out through
 * Cloudflare Email Sending from stann@terminal.stann.kr, replies go to SIGNAL_REPLY_TO: the owner's
 * own address, read from the environment or .env like the secret and never kept in the repository
 * (a run without it, or with something that is not one plain address, stops before the list is read). Each message
 * gets its own unsubscribe link ({{UNSUBSCRIBE_URL}} in the html and text), signed with
 * SIGNAL_UNSUBSCRIBE_SECRET (the Worker's secret; read from the environment or .env), and the
 * List-Unsubscribe / List-Unsubscribe-Post headers that give mail apps a one-click button. Sending
 * uses the wrangler OAuth login (the API token in .env has no Email Sending permission), so the repo .env is not loaded for
 * it. Each subscriber sent to is appended, by signal id, to a log of that mail (git-ignored):
 * backups/signal-mail/<key>.log, the key taken from the subject, html and text, so the same mail
 * always reads the same log on any day and a different mail starts its own. A re-run skips the ids
 * (or, in a log written before ids, the addresses) in it; --log <file> names the log instead.
 * --only does not read the log: running it twice sends twice. The log is opened before the first
 * mail goes out (a log that cannot be written sends nothing), and a mail that went out but could
 * not be logged stops the run with the id to add by hand.
 */
const DATABASE = 'terminal-db';
const FROM = 'stann@terminal.stann.kr';
const SITE = 'https://terminal.stann.kr';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Addresses that cannot be delivered (a misspelt domain); left out rather than bounced.
const UNDELIVERABLE = /@(gamil|gmial|gmai|naver\.co)\.(com|kr)$|@gmail\.co$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
/** What went wrong in a failed wrangler run, with addresses masked. */
const reason = failureReason;
process.on('uncaughtException', error => fail(reason(error)));

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const [htmlFile, textFile] = positionalArgs(args, VALUE_FLAGS);
const subject = option('--subject');
const only = option('--only');
const send = args.includes('--send');
if (!htmlFile || !textFile || !subject) fail('usage: <mail.html> <mail.txt> --subject "<subject>" [--only <address> | --send]');
if (only && send) fail('--only and --send are separate runs');
if (subject.trim().length < 10) fail('the subject is shorter than 10 characters: write the real subject');
if (send && /\bTEST\b/i.test(subject)) fail('a TEST subject never goes to the whole list');
const confirm = option('--confirm');
/** Stops before sending unless --confirm names exactly the number about to receive the mail. */
function confirmed(count, what) {
  if (confirm === String(count)) return true;
  console.log(`not sent: ${what}. To send, run again with --confirm ${count}.`);
  return false;
}
const html = readFileSync(htmlFile, 'utf8');
const text = readFileSync(textFile, 'utf8');
const secret = readEnvValue('SIGNAL_UNSUBSCRIBE_SECRET');
if (!secret) fail('SIGNAL_UNSUBSCRIBE_SECRET is not set (environment or .env)');
// Where replies and the mailto unsubscribe go; also the one address --only does not log.
const REPLY_TO = replyToAddress(readEnvValue('SIGNAL_REPLY_TO'));
if (!REPLY_TO) fail('SIGNAL_REPLY_TO is not set to one mail address (environment or .env): replies and the mailto unsubscribe go there');
const unsubscribeUrl = id => `${SITE}/api/signal/unsubscribe?${new URLSearchParams({ s: id, t: createHmac('sha256', secret).update(id).digest('hex') })}`;

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
  const out = wrangler(['d1', 'execute', DATABASE, '--env', 'production', '--remote', '--json', '--command', 'SELECT id, lower(trim(email)) AS email FROM signal']);
  const rows = parseWranglerJson(out)[0]?.results ?? fail('wrangler returned no subscriber list');
  const deliverable = row => EMAIL.test(row.email) && !UNDELIVERABLE.test(row.email);
  return { valid: rows.filter(deliverable), skipped: rows.filter(row => !deliverable(row)) };
}

function sendTo({ id, email }) {
  const link = unsubscribeUrl(id);
  const fill = body => body.replaceAll('{{UNSUBSCRIBE_URL}}', link.replaceAll('&', body === html ? '&amp;' : '&'));
  wrangler(['email', 'sending', 'send',
    '--from', FROM, '--from-name', 'Stann · TERMINAL', '--reply-to', REPLY_TO, '--reply-to-name', 'Stann',
    '--to', email, '--subject', subject, '--html', fill(html), '--text', fill(text),
    '--header', `List-Unsubscribe:<${link}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
    '--header', 'List-Unsubscribe-Post:List-Unsubscribe=One-Click'], { oauth: true });
}

const logFile = option('--log') ?? defaultLogFile(process.cwd(), { subject, html, text });
/**
 * Makes sure the log can be written, before anything is sent: a mail that goes out and cannot be
 * logged would go out again on the next run. A new log starts with a note of what mail it is for.
 */
function openLog() {
  try {
    mkdirSync(path.dirname(logFile), { recursive: true });
    appendFileSync(logFile, existsSync(logFile) ? '' : `# ${new Date().toISOString()} ${subject.replaceAll('\n', ' ')}\n`);
  } catch (error) {
    fail(`cannot write the send log ${path.relative(process.cwd(), logFile)} (${error?.code ?? reason(error)}): nothing was sent`);
  }
}
/** Appends a sent subscriber to the log. */
const logSent = row => appendFileSync(logFile, logLine(row));
/** Stops the run after a mail that went out without its log line, saying how to keep it from going out twice. */
function failUnlogged({ row, error }) {
  fail(`sent to signal id ${row.id}, but the send log could not be written (${error?.code ?? reason(error)}). Stopped there: add the line "${row.id}" to ${path.relative(process.cwd(), logFile)} before running again, or that subscriber gets this mail twice.`);
}
/** The ids (or older addresses) already sent this mail; a log that does not exist yet is empty. */
function sentSoFar() {
  try {
    return readSentLog(readFileSync(logFile, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set();
    throw error;
  }
}
/**
 * A mail with nothing logged yet reads no other log: say which ones exist, since a mail that was
 * corrected after part of it went out (or sent under a date-named log) continues only with --log.
 */
function warnAboutOtherLogs(sent) {
  if (option('--log') || sent.size) return;
  let names = [];
  try { names = readdirSync(path.dirname(logFile)); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const others = otherLogs(names, path.basename(logFile));
  if (others.length) console.log(`! nothing is logged for this exact mail yet, and other send logs are not read (${others.join(', ')}): if part of it already went out (before a correction, or under a date-named log), pass that log with --log.`);
}

if (only) {
  // The address must be on the list, so its unsubscribe link is real.
  const row = subscribers().valid.find(item => item.email === only.toLowerCase());
  if (!row) fail('--only takes an address on the Signal list');
  const owner = row.email === REPLY_TO;
  if (!confirmed(1, `"${subject}" to ${owner ? 'your own address' : 'a subscriber'} (${row.email})`)) process.exit(0);
  if (!owner) openLog();
  sendTo(row);
  if (!owner) {
    try { logSent(row); } catch (error) { failUnlogged({ row, error }); }
  }
  console.log(`✓ sent to ${row.email}`);
  process.exit(0);
}

const { valid, skipped } = subscribers();
const sent = sentSoFar();
warnAboutOtherLogs(sent);
const pending = pendingRecipients(valid, sent);
console.log(`${valid.length} subscribers, ${skipped.length} undeliverable left out, ${valid.length - pending.length} already sent in ${path.relative(process.cwd(), logFile)}`);
if (!pending.length) {
  console.log('nothing to send: everyone on the list already has this mail.');
  process.exit(0);
}
if (!send) {
  console.log(`dry run: ${pending.length} would receive "${subject}". Add --send --confirm ${pending.length} to send.`);
  process.exit(0);
}
if (!confirmed(pending.length, `"${subject}" to ${pending.length} subscribers`)) process.exit(0);
openLog();
const { sent: delivered, failed, unlogged } = sendPending(pending, {
  send: sendTo,
  log: logSent,
  onSent: index => console.log(`✓ ${index + 1}/${pending.length}`),
  onFailed: (index, error) => console.error(`✖ ${index + 1}/${pending.length}: ${reason(error)}`),
});
if (unlogged) {
  console.log(`${delivered} sent, ${failed} failed, ${pending.length - delivered - failed} not tried`);
  failUnlogged(unlogged);
}
console.log(`${delivered} sent, ${failed} failed`);
process.exit(failed ? 1 : 0);
