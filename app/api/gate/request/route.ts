import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { noStoreJson } from "@/lib/api/responses";
import { getDb } from "@/lib/db/client";
import {
  createAccessRequestAtomically,
} from "@/lib/gate/d1AccessRequestRepository";
import {
  listGateArtistRowsByEvent,
  listGateEventRows,
} from "@/lib/gate/d1GateReadRepository";
import {
  findUpcomingGateEvent,
  isGateRequestWindowActive,
  parseGateRequestBody,
  resolveArtistAccessCode,
} from "@/lib/gate/createAccessRequest";
import { generateId } from "@/lib/utils/id";

/** POST /api/gate/request */
export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody(request, 16_384);
    if (!parsed.ok) return parsed.response;

    const requestInput = parseGateRequestBody(parsed.body);
    if (!requestInput.ok) {
      return noStoreJson({ error: requestInput.error }, 400);
    }

    const { env } = getCloudflareContext();
    const abuseDecision = await enforceRateLimit(env, 'gate-request', request);
    if (!abuseDecision.ok) {
      return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);
    }
    const db = getDb(env.DB);
    const now = new Date();

    const eventRows = await listGateEventRows(db);
    const upcomingEvent = findUpcomingGateEvent(eventRows, now);

    if (!upcomingEvent) {
      return noStoreJson({ error: "NO_UPCOMING_EVENT" }, 404);
    }
    if (upcomingEvent.rowId !== requestInput.input.eventId) {
      return noStoreJson({ error: "EVENT_MISMATCH" }, 409);
    }
    if (!isGateRequestWindowActive(upcomingEvent, now)) {
      return noStoreJson({ error: "REQUEST_PERIOD_INACTIVE" }, 403);
    }

    const artistRows = await listGateArtistRowsByEvent(db, upcomingEvent.rowId);
    const accessCodeResult = resolveArtistAccessCode(artistRows, requestInput.input.accessCode);
    if (accessCodeResult.kind === 'unavailable') {
      return noStoreJson({ error: "DATA_UNAVAILABLE" }, 503);
    }
    if (accessCodeResult.kind === 'not_found') {
      return noStoreJson({ error: "INVALID_ACCESS_CODE" }, 401);
    }

    const result = await createAccessRequestAtomically(env.DB, {
      id: generateId("req"),
      signalId: generateId("sig"),
      eventId: upcomingEvent.rowId,
      artistId: accessCodeResult.artistId,
      invitedBy: accessCodeResult.data.name,
      name: requestInput.input.name,
      email: requestInput.input.email,
      instagram: requestInput.input.instagram,
      privacyConsent: requestInput.input.privacyConsent,
      marketingConsent: requestInput.input.marketingConsent,
      guestLimit: accessCodeResult.data.guestLimit,
      createdAt: now.toISOString(),
    });

    if (result.status === "duplicate") return noStoreJson({ ok: true });
    if (result.status === "guest_limit_reached") {
      return noStoreJson({ error: "GUEST_LIMIT_REACHED" }, 409);
    }

    return noStoreJson({ ok: true });
  } catch {
    console.error("[POST /api/gate/request] internal error");
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
