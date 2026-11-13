import type { MetadataRoute } from 'next';
import { artistHref, buildArtistArchive } from '@/features/artists/model';
import { SITE_ORIGIN } from '@/features/events/metadata';
import { eventHref } from '@/features/events/model';
import { readPublicEvents } from '@/lib/events/requestEvents';

// Sessions and artists come from the live database, so the sitemap is read per request.
export const dynamic = 'force-dynamic';

/** The stage's views, every public session and every artist file. Without the database, the views alone. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = (await readPublicEvents()) ?? [];
  return [
    '/', '/events', '/artists', '/transmit', '/signal', '/about',
    ...events.map((event) => eventHref(event.id)),
    ...buildArtistArchive(events).map((profile) => artistHref(profile.key)),
  ].map((path) => ({ url: new URL(path, SITE_ORIGIN).href }));
}
