import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Access } from '@/features/access/Access';
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: encodedKey } = await params;
  let eventId: string;
  try { eventId = decodeURIComponent(encodedKey); } catch { notFound(); }
  return <Access eventId={eventId}/>;
}
export const metadata: Metadata = { title: '게스트 신청' };
