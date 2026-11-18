import { getCloudflareContext } from '@opennextjs/cloudflare';
import { safeLogError } from '../api/safeLog';
import { getDb } from '../db/client';
import { resolveArtistAccessCode } from '../gate/createAccessRequest';
import { listGateArtistRowsByEvent } from '../gate/d1GateReadRepository';
import { readEntryCookie, type Entry } from './entry';
import { writeTrace } from './d1TraceRepository';
import { buildTrace, type SubmissionKind } from './record';

async function codeArtist(env: CloudflareEnv, entry: Entry | null): Promise<string | null> {
  if (entry?.kind !== 'code' || !entry.target || !entry.code) return null;
  const result = resolveArtistAccessCode(await listGateArtistRowsByEvent(getDb(env.DB), entry.target), entry.code);
  return result.kind === 'match' ? result.artistId : null;
}

/**
 * Records where an accepted public submission came from, after the response is decided: it runs
 * in the background (waitUntil) and a failure here never fails the submission itself.
 */
export async function recordSubmission(
  request: Request,
  kind: SubmissionKind,
  recordId: string,
  now: Date = new Date(),
): Promise<void> {
  try {
    const { env, cf, ctx } = await getCloudflareContext({ async: true });
    const headers = new Headers(request.headers);
    const entry = readEntryCookie(headers.get('cookie'));
    const work = (async () => {
      try {
        const trace = await buildTrace({
          kind,
          recordId,
          now,
          headers,
          cf: cf as Record<string, unknown> | undefined,
          entry,
          codeArtistId: await codeArtist(env, entry),
          secret: env.TRACE_HASH_SECRET,
        });
        await writeTrace(env.DB, trace, now);
      } catch (error) {
        safeLogError('trace.write_failed', { error, kind });
      }
    })();
    if (ctx?.waitUntil) ctx.waitUntil(work);
    else await work;
  } catch (error) {
    safeLogError('trace.unavailable', { error, kind });
  }
}
