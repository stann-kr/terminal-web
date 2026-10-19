import { NextResponse } from 'next/server';
import { sessionsCalendar } from '@/features/events/calendar';
import { SITE_ORIGIN } from '@/features/events/metadata';
import { readPublicEvents } from '@/lib/events/requestEvents';

/**
 * The TERMINAL calendar feed. Subscribed calendars re-read it, so changes reach them. Its links name
 * the public site whichever address served it.
 */
export async function GET() {
  const events = await readPublicEvents();
  if (!events) {
    return NextResponse.json({ error: 'DATA_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(sessionsCalendar(events, SITE_ORIGIN), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="terminal.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
