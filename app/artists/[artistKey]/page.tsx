import type { Metadata } from 'next';
import { ArtistDetail } from '@/features/artists/Artists';
export default async function Page({ params }: { params: Promise<{ artistKey: string }> }) {
  const { artistKey } = await params;
  return <ArtistDetail artistKey={artistKey}/>;
}
export const metadata: Metadata = { title: '아티스트 출연 이력' };
