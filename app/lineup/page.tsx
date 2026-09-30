import { redirect } from 'next/navigation';
import { artistIdentities } from '@/features/artists/identities';
import { appearanceKey, artistHref } from '@/features/artists/model';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const eventId = typeof params.eventId === 'string' ? params.eventId : typeof params.event === 'string' ? params.event : null;
  const artist = typeof params.artist === 'string' ? params.artist : null;
  if(eventId && artist) { const identity = artistIdentities.find(item => item.appearances.some(row => row.eventId === eventId && row.artistRowId === artist)); redirect(artistHref(identity?.key ?? appearanceKey(eventId,artist))); }
  if(eventId) redirect(`/events/${encodeURIComponent(eventId)}`);
  redirect('/artists');
}
