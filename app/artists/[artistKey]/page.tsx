import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArtistDetail } from '@/features/artists/Artists';
import { artistIdentities } from '@/features/artists/identities';
import { appearanceKey, artistHref } from '@/features/artists/model';
export default async function Page({ params }: { params: Promise<{ artistKey: string }> }) {
  const { artistKey: encodedKey } = await params;
  let artistKey: string;
  try { artistKey = decodeURIComponent(encodedKey); } catch { notFound(); }
  const identity = artistIdentities.find(item => item.appearances.some(row => appearanceKey(row.eventId, row.artistRowId) === artistKey));
  if (identity) redirect(artistHref(identity.key));
  return <ArtistDetail artistKey={artistKey}/>;
}
export const metadata: Metadata = { title: '아티스트 출연 이력' };
