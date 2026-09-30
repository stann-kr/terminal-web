import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...await importOriginal<typeof import('drizzle-orm')>(),
  eq: mocks.eq,
}));

import {
  listStoredArtistRows,
  listStoredArtistRowsByEvent,
  listStoredEventRows,
  listPublicEvents,
} from '../lib/events/d1EventReadRepository';
import {
  listGateArtistRowsByEvent,
  listGateEventRows,
} from '../lib/gate/d1GateReadRepository';
import { artists, events } from '../lib/db/schema';

function createAllQuery(rows: unknown[]) {
  const all = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ all }));
  const select = vi.fn(() => ({ from }));
  return { all, from, select };
}

describe('Events D1 read repository', () => {
  it('shares the validated public projection with SSR without leaking stored access fields', async () => {
    const eventData = {
      session: 'PUBLIC SESSION', subtitle: 'TEST', date: '2020-01-01', time: '23:00 KST',
      venue: 'VENUE', district: 'SEOUL', coords: '0,0', capacity: '100', sound: 'SYSTEM', status: 'UPCOMING',
      internalNote: 'private event note',
    };
    const artistData = {
      name: 'PUBLIC ARTIST', origin: 'KR', dock: '1', time: '23:00', status: 'CONFIRMED',
      guestCode: 'private access code', guestLimit: 99,
    };
    const eventRows = [
      { id: 'valid', data: JSON.stringify(eventData) },
      { id: 'invalid-artist', data: JSON.stringify(eventData) },
      { id: 'invalid-event', data: '{}' },
      { id: '__proto__', data: JSON.stringify(eventData) },
    ];
    const artistRows = [
      { id: 'public-artist', eventId: 'valid', data: JSON.stringify(artistData) },
      { id: 'bad-artist', eventId: 'invalid-artist', data: '{}' },
      { id: 'opaque-key-artist', eventId: '__proto__', data: JSON.stringify(artistData) },
    ];
    const database = {
      select: () => ({ from: (table: unknown) => ({ all: async () => table === events ? eventRows : artistRows }) }),
    };
    const result = await listPublicEvents(database as never);
    expect(result.map(event => event.id)).toEqual(['valid', '__proto__']);
    expect(result[0]).toMatchObject({ status: 'ARCHIVED', artists: [{ id: 'public-artist', name: 'PUBLIC ARTIST' }] });
    expect(result[1].artists[0].id).toBe('opaque-key-artist');
    expect(JSON.stringify(result)).not.toMatch(/private|guestCode|guestLimit|internalNote/);
  });

  it('propagates database failure to the HTTP or SSR caller without fabricating an empty directory', async () => {
    const failure = new Error('unavailable');
    const database = { select: () => ({ from: () => ({ all: async () => { throw failure; } }) }) };
    await expect(listPublicEvents(database as never)).rejects.toBe(failure);
  });

  it('selects only stored event identifiers and JSON data', async () => {
    const rows = [{ id: 'event-1', data: '{"status":"UPCOMING"}' }];
    const query = createAllQuery(rows);

    await expect(listStoredEventRows({ select: query.select } as never)).resolves.toEqual(rows);
    expect(query.select).toHaveBeenCalledWith({ id: events.id, data: events.data });
    expect(query.from).toHaveBeenCalledWith(events);
  });

  it('selects the event ownership key with public artist rows', async () => {
    const rows = [{ id: 'artist-1', eventId: 'event-1', data: '{"name":"ARTIST"}' }];
    const query = createAllQuery(rows);

    await expect(listStoredArtistRows({ select: query.select } as never)).resolves.toEqual(rows);
    expect(query.select).toHaveBeenCalledWith({
      id: artists.id,
      eventId: artists.eventId,
      data: artists.data,
    });
    expect(query.from).toHaveBeenCalledWith(artists);
  });

  it('scopes public artist rows to the requested event', async () => {
    const rows = [{ id: 'artist-1', eventId: 'event-1', data: '{"name":"ARTIST"}' }];
    const all = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ all }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mocks.eq.mockClear();

    await expect(listStoredArtistRowsByEvent({ select } as never, 'event-1')).resolves.toEqual(rows);
    expect(select).toHaveBeenCalledWith({
      id: artists.id,
      eventId: artists.eventId,
      data: artists.data,
    });
    expect(from).toHaveBeenCalledWith(artists);
    expect(mocks.eq).toHaveBeenCalledWith(artists.eventId, 'event-1');
    expect(where).toHaveBeenCalledWith(mocks.eq.mock.results[0]?.value);
  });
});

describe('Gate D1 read repository', () => {
  it('returns only stored event identifiers and JSON data', async () => {
    const eventRows = [{ id: 'event-1', data: '{"status":"UPCOMING"}' }];
    const query = createAllQuery(eventRows);

    await expect(listGateEventRows({ select: query.select } as never)).resolves.toEqual(eventRows);
    expect(query.select).toHaveBeenCalledWith({ id: events.id, data: events.data });
    expect(query.from).toHaveBeenCalledWith(events);
  });

  it('scopes stored artist access rows to the selected event', async () => {
    const artistRows = [{ id: 'artist-1', data: '{"guestCode":"CODE"}' }];
    const all = vi.fn().mockResolvedValue(artistRows);
    const where = vi.fn(() => ({ all }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mocks.eq.mockClear();

    await expect(
      listGateArtistRowsByEvent({ select } as never, 'event-1'),
    ).resolves.toEqual(artistRows);
    expect(select).toHaveBeenCalledWith({ id: artists.id, data: artists.data });
    expect(from).toHaveBeenCalledWith(artists);
    expect(mocks.eq).toHaveBeenCalledWith(artists.eventId, 'event-1');
    expect(where).toHaveBeenCalledWith(mocks.eq.mock.results[0]?.value);
  });
});
