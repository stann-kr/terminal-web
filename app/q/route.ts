import { NextResponse } from 'next/server';

/**
 * The link printed in the QR stickers: Home, reached through its own path so the scans can be told
 * apart in the zone's request analytics (path `/q`). Never cached, so each scan reaches the edge
 * as a request of its own. Home opens tagged `?from=qr`, so a scan that ends in a guest request,
 * a Transmit post or a Signal subscription says so in its access record (lib/trace/entry).
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL('/?from=qr', request.url), { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
