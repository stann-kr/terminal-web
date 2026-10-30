import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { hasOnlyKeys, isString } from "@/lib/api/validation";
import { getDb } from "@/lib/db/client";
import { loadPublicEvents } from "@/lib/events/publicEvents";
import {
  findUpcomingGateEvent,
  inspectArtistAccessData,
  isGateRequestWindowActive,
} from "@/lib/gate/createAccessRequest";
import { listGateEventRows } from "@/lib/gate/d1GateReadRepository";
import { isArtistId, verifyHostLink } from "@/lib/gate/hostLink";
import type { HostView } from "@/lib/gate/hostView";

/** Every way a link can fail answers the same, so the page never tells which artist ids exist. */
const invalid = () => noStoreJson({ error: "INVALID_HOST_LINK" }, 404);

/**
 * POST /api/invite/host  { artistId, t }
 * The artist's own page: its invite code, how many guests used it, and their names. The token is
 * the credential (see lib/gate/hostLink), so the body carries it rather than a cached GET.
 */
export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody(request, 1_024);
    if (!parsed.ok) return parsed.response;
    const { body } = parsed;
    if (!hasOnlyKeys(body, ["artistId", "t"]) || !isString(body.artistId) || !isString(body.t)) {
      return noStoreJson({ error: "INVALID_INPUT" }, 400);
    }
    if (!isArtistId(body.artistId)) return invalid();

    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'host', request);
    if (!abuseDecision.ok) return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);

    const row = await env.DB.prepare("SELECT event_id, data FROM artists WHERE id = ?")
      .bind(body.artistId)
      .first<{ event_id: string; data: string }>();
    const access = row ? inspectArtistAccessData(row.data) : null;
    if (!row || access?.kind !== 'configured') return invalid();
    if (!await verifyHostLink(env.SIGNAL_UNSUBSCRIBE_SECRET ?? '', body.artistId, access.data.guestCode, body.t)) {
      return invalid();
    }

    const db = getDb(env.DB);
    const event = (await loadPublicEvents(db)).find((item) => item.id === row.event_id);
    if (!event) return invalid();
    const guests = await env.DB.prepare(
      "SELECT name, created_at FROM access_requests WHERE event_id = ? AND artist_id = ? ORDER BY created_at DESC",
    )
      .bind(row.event_id, body.artistId)
      .all<{ name: string; created_at: string }>();
    const now = new Date();
    const upcoming = findUpcomingGateEvent(await listGateEventRows(db), now);
    const count = guests.results.length;
    const view: HostView = {
      artist: access.data.name,
      event: {
        id: event.id,
        session: event.session,
        subtitle: event.subtitle,
        date: event.date,
        time: event.time,
        venue: event.venue,
        status: event.status,
      },
      code: access.data.guestCode,
      limit: access.data.guestLimit,
      count,
      open: upcoming?.rowId === event.id
        && isGateRequestWindowActive(upcoming, now)
        && count < access.data.guestLimit,
      guests: guests.results.map((guest) => ({ name: guest.name, createdAt: guest.created_at })),
    };
    return noStoreJson(view);
  } catch (error) {
    safeLogError('invite.host_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
