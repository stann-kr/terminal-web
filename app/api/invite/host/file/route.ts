import { getCloudflareContext } from "@opennextjs/cloudflare";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { verifiedHostArtist } from "@/lib/gate/hostAccess";
import { promoFileFor } from "@/lib/gate/promoKit";

/**
 * GET /api/invite/host/file?a=<artist id>&t=<token>&f=<key>
 * One promo file from the private bucket, for the artist whose host link this is and only among
 * the files their page lists. The full file comes as a download, its preview inline. Every way a
 * request can fail answers the same 404, as the host page does.
 */
export async function GET(request: Request) {
  const missing = () => noStoreJson({ error: "FILE_NOT_FOUND" }, 404);
  try {
    const params = new URL(request.url).searchParams;
    const artistId = params.get("a") ?? "", token = params.get("t") ?? "", key = params.get("f") ?? "";
    const { env } = await getCloudflareContext({ async: true });
    // A budget of its own: one page draws a preview per file, and those must not use up the
    // attempts the page itself, a guest entry and a waitlist move share.
    const abuseDecision = await enforceRateLimit(env, 'host-file', request);
    if (!abuseDecision.ok) return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);

    const host = await verifiedHostArtist(env.DB, env.SIGNAL_UNSUBSCRIBE_SECRET ?? "", artistId, token);
    const item = host ? await promoFileFor(env.PRESS, host.eventId, artistId, key) : null;
    if (!item || !env.PRESS) return missing();
    const object = await env.PRESS.get(key);
    if (!object) return missing();

    const full = key === item.key;
    const headers = new Headers({
      "Content-Type": full ? "image/png" : "image/jpeg",
      // The link is personal: browsers may keep it, shared caches may not.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    });
    if (full) headers.set("Content-Disposition", `attachment; filename="${item.download}"`);
    if (object.size) headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  } catch (error) {
    safeLogError('invite.host_file_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
