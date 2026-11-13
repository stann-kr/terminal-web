import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HostPage } from '@/features/host/HostPage';

/** The link is the artist's credential: never indexed, never followed. */
export const metadata: Metadata = {
  title: '게스트 초대',
  robots: { index: false, follow: false },
};

/** An artist's own page, off the stage: their invite link, and who has used it. */
export default async function Page({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;
  let id = '';
  try {
    id = decodeURIComponent(artistId);
  } catch {
    // A malformed address reads as an invalid link below.
  }
  return (
    <Suspense fallback={null}>
      <HostPage artistId={id} />
    </Suspense>
  );
}
