import { redirect } from 'next/navigation';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const eventId = typeof params.eventId === 'string' ? params.eventId : typeof params.event === 'string' ? params.event : null;
  if(eventId) redirect(`/events/${encodeURIComponent(eventId)}`);
  redirect('/events');
}
