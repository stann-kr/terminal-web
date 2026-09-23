import { describe, expect, it } from 'vitest';
import { parsePublicArtistRow, parsePublicEventRow } from '../lib/events/publicDtos';

const artistData = {
  name: 'ARTIST',
  origin: 'KR',
  dock: '1',
  time: '23:00',
  status: 'CONFIRMED',
};

const eventData = {
  session: 'TERMINAL [03]',
  subtitle: 'TEST',
  date: '2026-09-01',
  time: '23:00 KST',
  venue: 'VENUE',
  district: 'DISTRICT',
  coords: '0,0',
  capacity: '100',
  sound: 'SYSTEM',
  status: 'UPCOMING',
};

describe('public event DTOs', () => {
  it('whitelists artist fields and removes access data', () => {
    const artist = parsePublicArtistRow({
      id: 'a1',
      eventId: 'e1',
      data: JSON.stringify({ ...artistData, guestCode: 'SECRET', guestLimit: 20, internalNote: 'private' }),
    });

    expect(artist).toEqual({ id: 'a1', ...artistData });
    expect(artist && 'guestCode' in artist).toBe(false);
    expect(artist && 'internalNote' in artist).toBe(false);
  });

  it('whitelists event fields and rejects malformed required data', () => {
    const event = parsePublicEventRow(
      { id: 'e1', data: JSON.stringify({ ...eventData, internalNote: 'private' }) },
      [],
    );

    expect(event).toEqual({ id: 'e1', ...eventData, artists: [] });
    expect(event && 'internalNote' in event).toBe(false);
    expect(parsePublicEventRow(
      { id: 'e2', data: JSON.stringify({ ...eventData, date: 'tomorrow' }) },
      [],
    )).toBeNull();
  });

  it.each([
    { date: '2026-02-31' },
    { time: '24:00 KST' },
  ])('rejects event calendar and time values the runtime cannot use: %j', (invalid) => {
    expect(parsePublicEventRow(
      { id: 'invalid', data: JSON.stringify({ ...eventData, ...invalid }) },
      [],
    )).toBeNull();
  });
});
