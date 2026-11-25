import { getCloudflareContext } from '@opennextjs/cloudflare';
import { safeLogError } from '@/lib/api/safeLog';
import { recordMailStat, verifyMailStat, type MailStatKind } from './stats';

/**
 * Counts one load of a mail's pixel or link when its signature holds. Counting never changes the
 * answer: a missing table, secret or database only loses the count.
 */
export async function countMailStat(kind: MailStatKind, key: string, target: string, token: string): Promise<boolean> {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    if (!(await verifyMailStat(env.SIGNAL_UNSUBSCRIBE_SECRET ?? '', key, target, token))) return false;
    const write = recordMailStat(env.DB, { key, kind, target, now: new Date() })
      .catch((error) => safeLogError('mail_stat.write_failed', { error }));
    if (ctx?.waitUntil) ctx.waitUntil(write);
    else await write;
    return true;
  } catch (error) {
    safeLogError('mail_stat.failed', { error });
    return false;
  }
}
