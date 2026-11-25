import { NextResponse } from 'next/server';
import { countMailStat } from '@/lib/mail/statRoute';

/**
 * GET /api/mail/click?k=<mail key>&u=<link>&s=<signature> — a link in a Signal mail (lib/mail/stats).
 * A link the mail script signed is counted and followed; anything else goes to Home uncounted, so
 * the route never sends anyone to an address the script did not put in a mail.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = params.get('u') ?? '';
  const counted = await countMailStat('click', params.get('k') ?? '', target, params.get('s') ?? '');
  return NextResponse.redirect(counted ? target : new URL('/', request.url), { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
