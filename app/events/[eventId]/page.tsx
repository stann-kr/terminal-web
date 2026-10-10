import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eventMetadata, eventStructuredData, jsonLd } from '@/features/events/metadata';
import { readPublicEvents } from '@/lib/events/requestEvents';
import { findEvent } from '../findEvent';

/**
 * The stage draws the session from the address; the page only answers for it. An id the events do
 * not have is a 404 (the stage shows it as a notice in the directory). When the events cannot be
 * read, the stage shows that with a retry, so it is not a 404.
 */
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let id: string;
  try {
    id = decodeURIComponent(eventId);
  } catch {
    notFound();
  }
  const events = await readPublicEvents();
  const event = events?.find((item) => item.id === id);
  if (events && !event) notFound();
  return event ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(eventStructuredData(event)) }} /> : null;
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const event = await findEvent((await params).eventId);
  return event ? eventMetadata(event) : { title: '이벤트 상세' };
}
