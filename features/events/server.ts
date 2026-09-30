import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/lib/db/client';
import { listPublicEvents } from '@/lib/events/d1EventReadRepository';

/** Read after connection(): build-time rendering must never require a remote DB. */
export async function getInitialEvents() {
  try {
    const { env } = getCloudflareContext();
    const events = await listPublicEvents(getDb(env.DB));
    return { events, updatedAt: Date.now() };
  } catch {
    // Keep the stage available; the existing client query owns retry/error UI.
    console.error('[Stage events] initial read unavailable');
    return undefined;
  }
}
