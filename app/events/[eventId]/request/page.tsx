import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eventMetadata, inviteMetadata } from '@/features/events/metadata';
import { inviteCodeFrom } from '@/features/access/invite';
import { readInviter } from '@/lib/gate/readInviter';
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const event = await findEvent((await params).eventId);
  if (!event) return { title: '게스트 신청' };
  // An artist's invite link previews with the artist's name; an unknown code reads as a plain form.
  const code = inviteCodeFrom(new URLSearchParams(await searchParams as Record<string, string>).toString());
  const inviter = code ? await readInviter(event.id, code) : null;
  return inviter ? inviteMetadata(event, inviter) : eventMetadata(event, '게스트 신청 · ');
}
