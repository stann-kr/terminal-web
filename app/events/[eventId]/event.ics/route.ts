import { NextResponse } from 'next/server';
import { eventCalendar } from '@/features/events/calendar';
import { readPublicEvents } from '@/lib/events/requestEvents';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  let id: string;
  try {
    id = decodeURIComponent((await params).eventId);
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: noStore });
  }
  const events = await readPublicEvents();
  if (!events) return NextResponse.json({ error: 'DATA_UNAVAILABLE' }, { status: 503, headers: noStore });
  const event = events.find((item) => item.id === id);
  // Only a session that is still ahead goes into a calendar.
  const body = event && event.status !== 'ARCHIVED' ? eventCalendar(event, new URL(request.url).origin) : null;
  if (!event || !body) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: noStore });
  return new Response(body, {
    headers: {
      ...noStore,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="terminal-${event.id.replace(/[^A-Za-z0-9-]/g, '') || 'session'}.ics"`,
    },
  });
}
