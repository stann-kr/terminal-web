import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { verifyUnsubscribe } from "@/lib/signal/unsubscribeToken";

/**
 * POST /api/signal/unsubscribe?s=<subscription id>&t=<token>
 * Deletes the subscription (the consent keeps it until unsubscribe). The mail client's one-click
 * unsubscribe (RFC 8058) posts here with a form body, which is ignored: the query carries both
 * values. A repeat after the row is gone still answers ok.
 *
 * GET only opens the SIGNAL plate's unsubscribe key, since link scanners fetch every link.
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'signal', request);
    if (!abuseDecision.ok) return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);
    const id = searchParams.get('s') ?? '';
    if (!await verifyUnsubscribe(env.SIGNAL_UNSUBSCRIBE_SECRET ?? '', id, searchParams.get('t') ?? '')) {
      return noStoreJson({ error: "INVALID_UNSUBSCRIBE_LINK" }, 400);
    }
    await env.DB.prepare("DELETE FROM signal WHERE id = ?").bind(id).run();
    return noStoreJson({ ok: true });
  } catch (error) {
    safeLogError('signal.unsubscribe_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = new URL('/signal', request.url);
  for (const key of ['s', 't']) { const value = searchParams.get(key); if (value) target.searchParams.set(key, value); }
  return NextResponse.redirect(target, 303);
}
