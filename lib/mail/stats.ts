import { hmacHex, verifyHmacHex } from '../api/signature';
import { kstDay } from '../trace/linkOpens';

/**
 * Totals for a Signal mail: how often its open pixel loaded and how often each of its links was
 * pressed, per KST day. Nothing names a recipient: every copy of a mail carries the same pixel and
 * the same links, signed by the mail script (scripts/signal-mail.mjs) under the secret it shares
 * with the Worker. A signature covers the mail key and the link, so only addresses the script put
 * in a mail are counted or redirected to (no open redirect, no rows for made-up keys).
 *
 * The counts are loads, not people: Gmail fetches images through its proxy (one open can load once
 * or several times), Apple Mail may load them unopened, and link scanners may press links.
 */
export const MAIL_KEY = /^[0-9a-f]{16}$/;
const MAX_TARGET = 1_024;

export type MailStatKind = 'open' | 'click';

/** What is signed for a mail's pixel (`target` '') or one of its links; never an unsubscribe id. */
export const mailStatMessage = (key: string, target = ''): string => `mail-stat:${key}:${target}`;

export function signMailStat(secret: string, key: string, target = ''): Promise<string> {
  return hmacHex(secret, mailStatMessage(key, target));
}

/** Whether a mail's pixel or link was signed by the mail script. */
export async function verifyMailStat(secret: string, key: string, target: string, token: string): Promise<boolean> {
  if (!MAIL_KEY.test(key) || target.length > MAX_TARGET) return false;
  if (target && !target.startsWith('https://')) return false;
  return verifyHmacHex(secret, mailStatMessage(key, target), token);
}

export const RECORD_MAIL_STAT_SQL = `INSERT INTO mail_stats (mail_key, day, kind, target, count)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(mail_key, day, kind, target) DO UPDATE SET count = count + 1`;

export async function recordMailStat(
  database: Pick<D1Database, 'prepare'>,
  stat: { key: string; kind: MailStatKind; target?: string; now: Date },
): Promise<void> {
  await database.prepare(RECORD_MAIL_STAT_SQL).bind(stat.key, kstDay(stat.now), stat.kind, stat.target ?? '').run();
}
