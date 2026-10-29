import { NextResponse } from 'next/server';
import { calendarSubscribeHref } from '@/features/events/calendar';
import { SITE_ORIGIN } from '@/features/events/metadata';

/**
 * One link that subscribes to the TERMINAL calendar from anywhere (a mail cannot tell the device):
 * Apple devices get the `webcal:` feed, everything else Google Calendar's subscribe page, as the
 * session's calendar key does.
 */
export function GET(request: Request) {
  const apple = /iPhone|iPad|iPod|Macintosh/.test(request.headers.get('user-agent') ?? '');
  return NextResponse.redirect(calendarSubscribeHref(SITE_ORIGIN, apple), { status: 302, headers: { 'Cache-Control': 'no-store', Vary: 'User-Agent' } });
}
