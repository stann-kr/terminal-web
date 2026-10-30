import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '../db/client';
import { resolveArtistAccessCode } from './createAccessRequest';
import { listGateArtistRowsByEvent } from './d1GateReadRepository';

/**
 * Who an invite link's code belongs to, for the link's preview: the artist row and its name, or
 * `null` (no such code, unreadable data). The code itself never leaves the server this way.
 */
export async function readInviter(eventId: string, code: string): Promise<{ artistId: string; name: string } | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const result = resolveArtistAccessCode(await listGateArtistRowsByEvent(getDb(env.DB), eventId), code);
    return result.kind === 'match' ? { artistId: result.artistId, name: result.data.name } : null;
  } catch {
    console.error('[readInviter] artists unavailable');
    return null;
  }
}
