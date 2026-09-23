import { EventDetail } from '@/features/events/Events';
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventDetail eventId={eventId}/>;
}
