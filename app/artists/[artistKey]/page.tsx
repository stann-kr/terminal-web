import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { artistIdentities } from '@/features/artists/identities';
import { appearanceKey, artistHref } from '@/features/artists/model';
import { artistMetadata, findArtistProfile } from '@/features/events/metadata';
import { readPublicEvents } from '@/lib/events/requestEvents';

export default async function Page({ params }: { params: Promise<{ artistKey: string }> }) {
  const { artistKey: encodedKey } = await params;
  let artistKey: string;
  try { artistKey = decodeURIComponent(encodedKey); } catch { notFound(); }
  const identity = artistIdentities.find(item => item.appearances.some(row => appearanceKey(row.eventId, row.artistRowId) === artistKey));
  if (identity) redirect(artistHref(identity.key));
  // An artist the events do not have is a 404 (the stage shows it as a notice in the roster); when
  // the events cannot be read, the stage shows that with a retry instead.
  const events = await readPublicEvents();
  if (events && !findArtistProfile(events, artistKey)) notFound();
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ artistKey: string }> }): Promise<Metadata> {
  const fallback: Metadata = { title: '아티스트 출연 이력' };
  let key: string;
  try { key = decodeURIComponent((await params).artistKey); } catch { return fallback; }
  const events = await readPublicEvents();
  const profile = events && findArtistProfile(events, key);
  return profile ? artistMetadata(profile) : fallback;
}
