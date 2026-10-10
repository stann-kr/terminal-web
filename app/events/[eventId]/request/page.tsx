import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eventMetadata } from '@/features/events/metadata';
import { readPublicEvents } from '@/lib/events/requestEvents';
import { findEvent } from '../../findEvent';

/** The guest form of a session: a 404 for an id the events do not have, as the session page. */
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let id: string;
  try {
    id = decodeURIComponent(eventId);
  } catch {
    notFound();
  }
  const events = await readPublicEvents();
  if (events && !events.some((item) => item.id === id)) notFound();
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const event = await findEvent((await params).eventId);
  return event ? eventMetadata(event, '게스트 신청 · ') : { title: '게스트 신청' };
}
