import { readPublicEvents } from '@/lib/events/requestEvents';

/** The public event an `/events/[eventId]` segment names, or `null` (unknown id, bad encoding, no data). */
export async function findEvent(segment: string) {
  let id: string;
  try {
    id = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return (await readPublicEvents())?.find((event) => event.id === id) ?? null;
}
