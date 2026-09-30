import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { noStoreJson } from "@/lib/api/responses";
import { hasOnlyKeys, isString } from "@/lib/api/validation";
import { getDb } from "@/lib/db/client";
import {
  findUpcomingGateEvent,
  parseGateEventId,
  resolveArtistAccessCode,
} from "@/lib/gate/createAccessRequest";
import {
  listGateArtistRowsByEvent,
  listGateEventRows,
} from "@/lib/gate/d1GateReadRepository";

function json(body: { name: string | null } | { error: string }, status = 200) {
  return noStoreJson(body, status);
}

/**
 * POST /api/gate/code-info
 * 인증 코드에 매칭되는 아티스트 이름을 반환함 (초대인 자동 완성용).
 * guestCode 자체는 노출하지 않으며, 코드 유효 여부도 명시하지 않음.
 *
 * @body code - 인증 코드
 * @body eventId - 화면에 표시된 신청 대상 행사
 * @returns { name: string | null }; returns a no-store 503 error when verification is unavailable
 */
export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody(request, 1_024);
    if (!parsed.ok) {
      parsed.response.headers.set("Cache-Control", "no-store");
      return parsed.response;
    }

    if (!hasOnlyKeys(parsed.body, ["code", "eventId"]) || !isString(parsed.body.code)) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    const eventIdResult = parseGateEventId(parsed.body.eventId);
    if (!eventIdResult.ok) return json({ error: eventIdResult.error }, 400);

    const code = parsed.body.code.trim();

    if (code.length > 64) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    if (!code) {
      return json({ name: null });
    }

    const { env } = getCloudflareContext();
    const abuseDecision = await enforceRateLimit(env, 'code-info', request);
    if (!abuseDecision.ok) return json({ error: abuseDecision.error }, abuseDecision.status);
    const db = getDb(env.DB);

    const eventRows = await listGateEventRows(db);
    const now = new Date();
    const upcomingEvent = findUpcomingGateEvent(eventRows, now);

    if (!upcomingEvent) {
      return json({ error: "NO_UPCOMING_EVENT" }, 404);
    }
    if (upcomingEvent.rowId !== eventIdResult.eventId) {
      return json({ error: "EVENT_MISMATCH" }, 409);
    }

    const artistRows = await listGateArtistRowsByEvent(db, upcomingEvent.rowId);

    const accessCodeResult = resolveArtistAccessCode(artistRows, code);
    if (accessCodeResult.kind === 'unavailable') {
      return json({ error: "VERIFICATION_UNAVAILABLE" }, 503);
    }
    if (accessCodeResult.kind === 'not_found') {
      return json({ name: null });
    }

    return json({ name: accessCodeResult.data.name });
  } catch {
    console.error("[POST /api/gate/code-info] internal error");
    return json({ error: "VERIFICATION_UNAVAILABLE" }, 503);
  }
}
