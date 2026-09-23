import { Access } from '@/features/access/Access';
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <Access eventId={eventId}/>;
}
