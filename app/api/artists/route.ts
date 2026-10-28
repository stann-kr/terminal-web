import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { parseIdentifierQuery } from '@/lib/api/validation';
import { listStoredArtistRowsByEvent } from '@/lib/events/d1EventReadRepository';
import { parsePublicArtistRow } from '@/lib/events/publicDtos';
import { getDb } from '@/lib/db/client';

export async function GET(request: Request) {
  const eventId = parseIdentifierQuery(new URL(request.url).searchParams, 'eventId');
  if (eventId === undefined) {
    return NextResponse.json({ error: 'EVENT_ID_REQUIRED' }, { status: 400 });
  }
  if (eventId === null) {
    return NextResponse.json({ error: 'INVALID_EVENT_ID' }, { status: 400 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const rows = await listStoredArtistRowsByEvent(db, eventId);
    const result = rows.map(parsePublicArtistRow);

    if (result.some((artist) => artist === null)) {
      console.error('[GET /api/artists] invalid stored artist data');
      return NextResponse.json(
        { error: 'DATA_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[GET /api/artists] internal error');
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
