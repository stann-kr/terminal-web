import { getCloudflareContext } from '@opennextjs/cloudflare';
import { enforceRateLimit } from '../api/abuseControl';
import { getDb } from '../db/client';
import {
  findUpcomingGateEvent,
  isGateRequestWindowActive,
  resolveArtistAccessCode,
} from './createAccessRequest';
import { listGateArtistRowsByEvent, listGateEventRows } from './d1GateReadRepository';

/**
 * Who an invite link's code belongs to, for the link's preview: the artist row and its name, or
 * `null` (no such code, not the event taking requests now, unreadable data). A preview that names
 * the artist confirms the code, so each lookup spends the same per-address budget as the code
 * check (`code-info`); past it, or on any failure, the link previews as a plain form.
 */
export async function readInviter(
  eventId: string,
  code: string,
  readHeaders: () => Promise<HeadersInit>,
): Promise<{ artistId: string; name: string } | null> {
  try {
    // The address's own headers (cf-connecting-ip) decide its rate-limit budget.
    const request = new Request(`https://terminal.stann.kr/events/${encodeURIComponent(eventId)}/request`, {
      headers: await readHeaders(),
    });
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const now = new Date();
    const upcoming = findUpcomingGateEvent(await listGateEventRows(db), now);
    if (upcoming?.rowId !== eventId || !isGateRequestWindowActive(upcoming, now)) return null;
    if (!(await enforceRateLimit(env, 'code-info', request)).ok) return null;
    const result = resolveArtistAccessCode(await listGateArtistRowsByEvent(db, eventId), code);
    return result.kind === 'match' ? { artistId: result.artistId, name: result.data.name } : null;
  } catch {
    console.error('[readInviter] artists unavailable');
    return null;
  }
}
