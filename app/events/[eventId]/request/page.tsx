import type { Metadata } from 'next';
import { Access } from '@/features/access/Access';
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <Access eventId={eventId}/>;
}
export const metadata: Metadata = { title: '게스트 신청' };
