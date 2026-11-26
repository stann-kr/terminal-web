import { getCloudflareContext } from '@opennextjs/cloudflare';
import { safeLogError } from '../api/safeLog';
import {
  AUTHON_SYNC_ROW_SQL,
  buildAuthonGuestPayload,
  classifyAuthonReply,
  type AuthonSyncRow,
} from './syncPayload.mjs';

/**
 * Copies a listed guest to the venue's door list in authon (FAUST), under the inviting artist's
 * external link there. Terminal stays the authority for the list and its limits; authon only
 * receives. Runs after the response is decided and never fails the guest's own request: a guest
 * missed here (authon down, or its event for the night not made yet) is caught up by resending the
 * event with `npm run authon:sync`, which authon takes without duplicates.
 *
 * Off unless both the AUTHON service binding and AUTHON_SYNC_SECRET are set, which only the
 * production environment has: a local or development run never writes to the venue's real list.
 */

const SYNC_PATH = 'https://authon/api/internal/sync-guest';

export type AuthonSyncOutcome = 'disabled' | 'not_found' | 'invalid' | 'synced' | 'retry' | 'rejected';

export async function syncAccessRequestToAuthon(
  env: Pick<CloudflareEnv, 'DB' | 'AUTHON' | 'AUTHON_SYNC_SECRET'>,
  requestId: string,
): Promise<AuthonSyncOutcome> {
  if (!env.AUTHON || !env.AUTHON_SYNC_SECRET) return 'disabled';
  const row = await env.DB.prepare(AUTHON_SYNC_ROW_SQL).bind(requestId).first<AuthonSyncRow>();
  if (!row) return 'not_found';
  const payload = buildAuthonGuestPayload(row);
  if (!payload) return 'invalid';

  const response = await env.AUTHON.fetch(SYNC_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': env.AUTHON_SYNC_SECRET },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);
  return classifyAuthonReply(response.status, body);
}

/** Starts the copy in the background (waitUntil) for a request that was just stored. */
export async function scheduleAuthonSync(requestId: string): Promise<void> {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    if (!env.AUTHON || !env.AUTHON_SYNC_SECRET) return;
    const work = (async () => {
      try {
        const outcome = await syncAccessRequestToAuthon(env, requestId);
        if (outcome !== 'synced' && outcome !== 'disabled') {
          safeLogError('authon.sync_missed', { requestId, outcome });
        }
      } catch (error) {
        safeLogError('authon.sync_failed', { requestId, error });
      }
    })();
    if (ctx?.waitUntil) ctx.waitUntil(work);
    else await work;
  } catch (error) {
    safeLogError('authon.sync_unavailable', { error });
  }
}
