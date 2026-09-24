import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EventDetail } from '@/features/events/Events';
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: encodedKey } = await params;
  let eventId: string;
  try { eventId = decodeURIComponent(encodedKey); } catch { notFound(); }
  return <EventDetail eventId={eventId}/>;
}
export const metadata: Metadata = { title: '행사 상세' };
