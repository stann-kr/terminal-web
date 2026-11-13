import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { positionalArgs } from '../scripts/lib/cli.mjs';
import {
  VALUE_FLAGS,
  defaultLogFile,
  otherLogs,
  logLine,
  mailKey,
  pendingRecipients,
  readSentLog,
} from '../scripts/lib/signalMail.mjs';

const mail = { subject: 'TERMINAL [04] 공지입니다', html: '<p>hello {{UNSUBSCRIBE_URL}}</p>', text: 'hello {{UNSUBSCRIBE_URL}}' };
const rows = [
  { id: 'sig-a', email: 'a@example.com' },
  { id: 'sig-b', email: 'b@example.com' },
  { id: 'sig-c', email: 'c@example.com' },
];

describe('signal-mail send log', () => {
  it('keys the default log by the mail, not by the day', () => {
    const file = defaultLogFile('/repo', mail);
    expect(file).toBe(path.join('/repo', 'backups', 'signal-mail', `${mailKey(mail)}.log`));
    expect(defaultLogFile('/repo', { ...mail })).toBe(file);
    expect(file).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('gives a different mail a different log', () => {
    const key = mailKey(mail);
    expect(mailKey({ ...mail, subject: `${mail.subject}!` })).not.toBe(key);
    expect(mailKey({ ...mail, html: `${mail.html} ` })).not.toBe(key);
    expect(mailKey({ ...mail, text: `${mail.text} ` })).not.toBe(key);
    // Moving text between the parts is a different mail too.
    expect(mailKey({ subject: 'ab', html: 'c', text: '' })).not.toBe(mailKey({ subject: 'a', html: 'bc', text: '' }));
  });

  it('writes the signal id, never the address', () => {
    const line = logLine(rows[0]);
    expect(line).toBe('sig-a\n');
    expect(line).not.toContain('@');
  });

  it('skips subscribers already logged by id', () => {
    const sent = readSentLog(`# 2026-11-13T00:00:00.000Z ${mail.subject}\nsig-a\n\n`);
    expect(pendingRecipients(rows, sent).map((row) => row.id)).toEqual(['sig-b', 'sig-c']);
  });

  it('still honours a log written with addresses before ids', () => {
    const sent = readSentLog('b@example.com\nsig-c\n');
    expect(pendingRecipients(rows, sent).map((row) => row.id)).toEqual(['sig-a']);
  });

  it('ignores note lines and sends to everyone on an empty log', () => {
    expect(readSentLog('# a note\n')).toEqual(new Set());
    expect(pendingRecipients(rows, readSentLog(''))).toEqual(rows);
  });

  it('names the other send logs beside this mail’s: a corrected mail or a date-named log continues only with --log', () => {
    const own = `${mailKey(mail)}.log`;
    const corrected = `${mailKey({ ...mail, text: `${mail.text} (corrected)` })}.log`;
    expect(otherLogs([own, '2026-11-13.log', corrected, 'notes.txt'], own)).toEqual(['2026-11-13.log', corrected].sort());
    expect(otherLogs([own], own)).toEqual([]);
  });
});

describe('signal-mail arguments', () => {
  it('does not take the value of a flag for a file', () => {
    const args = ['--confirm', '3', 'mail.html', '--subject', 'TERMINAL 공지입니다', 'mail.txt', '--log', 'x.log', '--send'];
    expect(positionalArgs(args, VALUE_FLAGS)).toEqual(['mail.html', 'mail.txt']);
  });
});
