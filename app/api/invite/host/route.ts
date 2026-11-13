import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { hasOnlyKeys, isString } from "@/lib/api/validation";
import { getDb } from "@/lib/db/client";
import { loadPublicEvents } from "@/lib/events/publicEvents";
import { findUpcomingGateEvent, isGateRequestWindowActive } from "@/lib/gate/createAccessRequest";
import { listGateEventRows } from "@/lib/gate/d1GateReadRepository";
import { verifiedHostArtist } from "@/lib/gate/hostAccess";
import type { HostView } from "@/lib/gate/hostView";
import { promoKit } from "@/lib/gate/promoKit";

const promoHref = (artistId: string, token: string, key: string) =>
  `/api/invite/host/file?${new URLSearchParams({ a: artistId, t: token, f: key })}`;

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
    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'host', request);
    if (!abuseDecision.ok) return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);

    const { artistId, t: token } = body;
    const host = await verifiedHostArtist(env.DB, env.SIGNAL_UNSUBSCRIBE_SECRET ?? '', artistId, token);
    if (!host) return invalid();
    const { eventId, access } = host;

    const db = getDb(env.DB);
    const event = (await loadPublicEvents(db)).find((item) => item.id === eventId);
    if (!event) return invalid();
    const guests = await env.DB.prepare(
      "SELECT name, created_at FROM access_requests WHERE event_id = ? AND artist_id = ? ORDER BY created_at DESC",
    )
      .bind(eventId, body.artistId)
      .all<{ name: string; created_at: string }>();
    const waitlist = await env.DB.prepare(
      "SELECT id, name, instagram, created_at FROM access_waitlist WHERE event_id = ? AND artist_id = ? ORDER BY created_at ASC",
    )
      .bind(eventId, body.artistId)
      .all<{ id: string; name: string; instagram: string; created_at: string }>();
    // The posters are an extra: a bucket that cannot be read must not take the guest list with it.
    const kit = await promoKit(env.PRESS, eventId, artistId).catch((error: unknown) => {
      safeLogError('invite.host_kit_failed', { error });
      return [];
    });
    const now = new Date();
    const upcoming = findUpcomingGateEvent(await listGateEventRows(db), now);
    const count = guests.results.length;
    const view: HostView = {
      artist: access.name,
      event: {
        id: event.id,
        session: event.session,
        subtitle: event.subtitle,
        date: event.date,
        time: event.time,
        venue: event.venue,
        status: event.status,
      },
      code: access.guestCode,
      limit: access.guestLimit,
      count,
      open: upcoming?.rowId === event.id
        && isGateRequestWindowActive(upcoming, now)
        && count < access.guestLimit,
      guests: guests.results.map((guest) => ({ name: guest.name, createdAt: guest.created_at })),
      waitlist: waitlist.results.map((guest) => ({ id: guest.id, name: guest.name, instagram: guest.instagram, createdAt: guest.created_at })),
      kit: kit.map(({ key, thumbKey, ...item }) => ({
        ...item,
        href: promoHref(artistId, token, key),
        thumb: promoHref(artistId, token, thumbKey),
      })),
    };
    return noStoreJson(view);
  } catch (error) {
    safeLogError('invite.host_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
