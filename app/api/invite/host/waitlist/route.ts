import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { hasOnlyKeys, isString } from "@/lib/api/validation";
import { getDb } from "@/lib/db/client";
import { findUpcomingGateEvent, isGateRequestWindowActive } from "@/lib/gate/createAccessRequest";
import { promoteWaitlistedGuest } from "@/lib/gate/d1AccessRequestRepository";
import { listGateEventRows } from "@/lib/gate/d1GateReadRepository";
import { verifiedHostArtist } from "@/lib/gate/hostAccess";

/**
 * POST /api/invite/host/waitlist  { artistId, t, id }
 * The artist moves a waiting guest onto their list, under the same limit as every other guest.
 * The guest is not told by the site: the artist reaches them by the Instagram id the page shows.
 */
export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody(request, 1_024);
    if (!parsed.ok) return parsed.response;
    const { body } = parsed;
    if (
      !hasOnlyKeys(body, ["artistId", "t", "id"])
      || !isString(body.artistId)
      || !isString(body.t)
      || !isString(body.id)
      || body.id.length > 64
    ) {
      return noStoreJson({ error: "INVALID_INPUT" }, 400);
    }

    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'host', request);
    if (!abuseDecision.ok) return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);

    const host = await verifiedHostArtist(env.DB, env.SIGNAL_UNSUBSCRIBE_SECRET ?? '', body.artistId, body.t);
    if (!host) return noStoreJson({ error: "INVALID_HOST_LINK" }, 404);

    const now = new Date();
    const upcoming = findUpcomingGateEvent(await listGateEventRows(getDb(env.DB)), now);
    if (upcoming?.rowId !== host.eventId || !isGateRequestWindowActive(upcoming, now)) {
      return noStoreJson({ error: "REQUEST_PERIOD_INACTIVE" }, 403);
    }

    const result = await promoteWaitlistedGuest(env.DB, {
      id: body.id,
      eventId: host.eventId,
      artistId: body.artistId,
      guestLimit: host.access.guestLimit,
      promotedAt: now.toISOString(),
    });
    if (result === "not_found") return noStoreJson({ error: "WAITLIST_ENTRY_NOT_FOUND" }, 404);
    if (result === "guest_limit_reached") return noStoreJson({ error: "GUEST_LIMIT_REACHED" }, 409);
    // Listed by this move or already by another way: either way the guest is on the list now.
    return noStoreJson({ ok: true });
  } catch (error) {
    safeLogError('invite.host_waitlist_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
