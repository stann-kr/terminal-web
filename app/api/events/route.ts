import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { parseEnumQuery } from '@/lib/api/validation';
import {
  listStoredArtistRows,
  listStoredEventRows,
} from '@/lib/events/d1EventReadRepository';
import { toPublicEvents } from '@/lib/events/publicEvents';
import { getDb } from '@/lib/db/client';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { EventStatus } from '@/lib/events/types';

const EVENT_STATUSES = new Set<EventStatus>(['UPCOMING', 'LIVE', 'ARCHIVED']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = parseEnumQuery(searchParams, 'status', EVENT_STATUSES);
  if (statusFilter === null) {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
  }

  try {
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);
    const [eventRows, artistRows] = await Promise.all([
      listStoredEventRows(db),
      listStoredArtistRows(db),
    ]);

    const result = toPublicEvents(eventRows, artistRows, new Date())
      .filter((event) => statusFilter === undefined || event.status === statusFilter);

    if (statusFilter === 'UPCOMING') {
      result.sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime());
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[GET /api/events] internal error');
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
