import { cache } from 'react';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/lib/db/client';
import { loadPublicEvents } from './publicEvents';
import type { TerminalEvent } from './types';

/**
 * The public events for one server request (page metadata, the calendar file). Read once per
 * request; `null` when the database cannot be read, so callers fall back to generic copy.
 */
export const readPublicEvents = cache(async (): Promise<TerminalEvent[] | null> => {
  try {
    const { env } = getCloudflareContext();
    return await loadPublicEvents(getDb(env.DB));
  } catch {
    console.error('[readPublicEvents] events unavailable');
    return null;
  }
});
