import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * The parts of scripts/signal-mail.mjs that decide who still gets a mail. Nothing here runs on
 * import or touches the network.
 */

/** Flags of signal-mail that take a value (the value is not a file argument). */
export const VALUE_FLAGS = ['--subject', '--only', '--log', '--confirm'];

/**
 * A key for one mail: the same subject, html and text always give the same key, any change another.
 * @param {{ subject: string, html: string, text: string }} mail
 * @returns {string}
 */
export function mailKey({ subject, html, text }) {
  return createHash('sha256').update(JSON.stringify([subject, html, text])).digest('hex').slice(0, 16);
}

/**
 * The send log of one mail when --log is not given: backups/signal-mail/<mail key>.log.
 * @param {string} cwd
 * @param {{ subject: string, html: string, text: string }} mail
 * @returns {string}
 */
export function defaultLogFile(cwd, mail) {
  return path.join(cwd, 'backups', 'signal-mail', `${mailKey(mail)}.log`);
}

/**
 * What a send log says was already sent: one entry per line, the subscriber's signal id (or, in a
 * log written before ids, the address). Lines starting with # are notes.
 * @param {string} content
 * @returns {Set<string>}
 */
export function readSentLog(content) {
  return new Set(content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')));
}

/**
 * Whether the log already holds this subscriber, by id or by an address an older log wrote.
 * @param {{ id: string, email: string }} row
 * @param {Set<string>} sent
 */
export const alreadySent = (row, sent) => sent.has(String(row.id)) || sent.has(String(row.email).trim().toLowerCase());

/**
 * The subscribers the log does not yet hold.
 * @template {{ id: string, email: string }} Row
 * @param {Row[]} rows
 * @param {Set<string>} sent
 * @returns {Row[]}
 */
export function pendingRecipients(rows, sent) {
  return rows.filter((row) => !alreadySent(row, sent));
}

/**
 * The line logged for a sent mail: the signal id only, never the address.
 * @param {{ id: string }} row
 */
export const logLine = (row) => `${row.id}\n`;

/**
 * The other send logs beside this mail's: of another mail, of this mail before its text was
 * corrected (a changed mail has another key), or named by date as logs were before they were keyed
 * by the mail. None of them is read unless --log names it.
 * @param {string[]} names files in the log folder
 * @param {string} current this mail's log file name
 * @returns {string[]}
 */
export const otherLogs = (names, current) => names.filter((name) => name.endsWith('.log') && name !== current).sort();
