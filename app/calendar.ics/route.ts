import { NextResponse } from 'next/server';
import { sessionsCalendar } from '@/features/events/calendar';
import { readPublicEvents } from '@/lib/events/requestEvents';

/** The TERMINAL calendar feed. Subscribed calendars re-read it, so changes reach them. */
export async function GET(request: Request) {
  const events = await readPublicEvents();
  if (!events) {
    return NextResponse.json({ error: 'DATA_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(sessionsCalendar(events, new URL(request.url).origin), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="terminal.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
