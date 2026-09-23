import { ArtistDetail } from '@/features/artists/Artists';
export default async function Page({ params }: { params: Promise<{ artistKey: string }> }) {
  const { artistKey } = await params;
  return <ArtistDetail artistKey={artistKey}/>;
}
