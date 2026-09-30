import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    decodeURIComponent(eventId);
  } catch {
    notFound();
  }
  return null;
}
export const metadata: Metadata = { title: '게스트 신청' };
