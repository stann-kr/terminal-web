import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { scheduleAuthonSync } from "@/lib/authon/syncGuest";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { hasOnlyKeys, isBoolean, isString } from "@/lib/api/validation";
import { getDb } from "@/lib/db/client";
import {
  findUpcomingGateEvent,
  isGateRequestWindowActive,
  normalizeInstagram,
} from "@/lib/gate/createAccessRequest";
import { createAccessRequestAtomically } from "@/lib/gate/d1AccessRequestRepository";
import { listGateEventRows } from "@/lib/gate/d1GateReadRepository";
import { verifiedHostArtist } from "@/lib/gate/hostAccess";
import { generateId } from "@/lib/utils/id";

/**
 * POST /api/invite/host/guests  { artistId, t, name, instagram, consent }
 * An artist puts a guest on their own list from the host page, under the same limit as a guest's
 * own request. Only the name is needed: the Instagram id is optional, and without one (stored empty)
 * no duplicate check applies, since two guests may share a name and the artist answers for the list.
 * `consent` is the artist's word that the guest agreed to give what was entered; no email is taken,
 * and no news is sent to such a guest.
 */
export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody(request, 2_048);
    if (!parsed.ok) return parsed.response;
    const { body } = parsed;
    if (
      !hasOnlyKeys(body, ["artistId", "t", "name", "instagram", "consent"])
      || !isString(body.artistId)
      || !isString(body.t)
      || !isString(body.name)
      || !isString(body.instagram)
      || !isBoolean(body.consent)
    ) {
      return noStoreJson({ error: "INVALID_INPUT" }, 400);
    }
    const name = body.name.trim();
    if (!name) return noStoreJson({ error: "ALL_FIELDS_REQUIRED" }, 400);
    if (name.length > 100) return noStoreJson({ error: "INVALID_INPUT" }, 400);
    const instagram = body.instagram.trim() ? normalizeInstagram(body.instagram) : "";
    if (instagram === null) return noStoreJson({ error: "INVALID_INSTAGRAM_FORMAT" }, 400);
    if (!body.consent) return noStoreJson({ error: "GUEST_CONSENT_REQUIRED" }, 400);

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

    const requestId = generateId("req");
    const result = await createAccessRequestAtomically(env.DB, {
      id: requestId,
      signalId: generateId("sig"),
      eventId: host.eventId,
      artistId: body.artistId,
      invitedBy: host.access.name,
      name,
      email: null,
      instagram,
      marketingConsent: false,
      guestLimit: host.access.guestLimit,
      createdAt: now.toISOString(),
    });
    // The artist is the one asking, so a repeat or a full list is told plainly.
    if (result.status === "duplicate") return noStoreJson({ error: "GUEST_ALREADY_LISTED" }, 409);
    if (result.status === "guest_limit_reached") return noStoreJson({ error: "GUEST_LIMIT_REACHED" }, 409);
    if (result.status === "created") await scheduleAuthonSync(requestId);
    return noStoreJson({ ok: true });
  } catch (error) {
    safeLogError('invite.host_guest_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
