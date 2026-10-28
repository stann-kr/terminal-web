import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "@/lib/api/guards";
import { enforceRateLimit } from "@/lib/api/abuseControl";
import { safeLogError } from "@/lib/api/safeLog";
import { noStoreJson } from "@/lib/api/responses";
import { createSignalSubscription } from "@/lib/signal/createSignalSubscription";
import { validateSignalSubscriptionInput } from "@/lib/signal/subscriptionPolicy";

export async function POST(request: Request) {
  try {
    const parsed = await readJsonBody<Record<string, unknown>>(request, 8_192);
    if (!parsed.ok) return parsed.response;
    const validation = validateSignalSubscriptionInput(parsed.body);
    if (!validation.ok) return noStoreJson({ error: validation.error }, 400);

    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'signal', request);
    if (!abuseDecision.ok) {
      return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);
    }

    await createSignalSubscription(env.DB, validation.input);

    return noStoreJson({ ok: true });
  } catch (error) {
    safeLogError('signal.create_failed', { error });
    return noStoreJson({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
}
