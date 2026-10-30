import { describe, expect, it } from 'vitest';
import { parsePublicArtistRow, parsePublicEventRow } from '../lib/events/publicDtos';
import { toPublicEvents } from '../lib/events/publicEvents';

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

  it('passes the request window the gate uses, never an unchecked stored value', () => {
    const row = (accessWindowDays?: unknown) => parsePublicEventRow({ id: 'e1', data: JSON.stringify({ ...eventData, accessWindowDays }) }, []);
    expect(row(60)).toMatchObject({ accessWindowDays: 60 });
    expect(row('60')).toMatchObject({ accessWindowDays: 30 });
    expect(row()).not.toHaveProperty('accessWindowDays');
  });
  it('keeps a valid end time and rejects one the runtime cannot read', () => {
    expect(parsePublicEventRow({ id: 'e1', data: JSON.stringify({ ...eventData, endTime: '05:00' }) }, [])).toMatchObject({ endTime: '05:00' });
    expect(parsePublicEventRow({ id: 'e1', data: JSON.stringify({ ...eventData, endTime: 'late' }) }, [])).toBeNull();
  });

  it.each([
    { date: '2026-02-31' },
    { time: '24:00 KST' },
    { endTime: '24:00' },
  ])('rejects event calendar and time values the runtime cannot use: %j', (invalid) => {
    expect(parsePublicEventRow(
      { id: 'invalid', data: JSON.stringify({ ...eventData, ...invalid }) },
      [],
    )).toBeNull();
  });

  it('preserves bilingual editorial line breaks while whitelisting narrative fields', () => {
    const stage = { ko: '방향', en: 'Bearing' };
    const log = { ko: '헬리오포즈 돌파 후 204일. 미확인 신호 수신.', en: '204 days past the heliopause. Unidentified signal received.' };
    const description = {
      ko: '헬리오포즈 돌파 후 204일.\n미확인 신호 수신.\n\n1.337초마다 한 번.\n흔들림 없이, 정확하게.',
      en: '204 days past the heliopause.\nUnidentified signal received.\n\nOne pulse every 1.337 seconds.\nSteady. Exact.',
    };
    const event = parsePublicEventRow({
      id: 'TRM-03',
      data: JSON.stringify({ ...eventData, stage: { ...stage, internalNote: 'private' }, log, description }),
    }, []);
    expect(event).toEqual({ id: 'TRM-03', ...eventData, stage, log, description, artists: [] });
  });

  it.each([
    { stage: { ko: '방향' } },
    { stage: { ko: '방향', en: 'x'.repeat(101) } },
    { log: { ko: [], en: 'Signal received.' } },
    { log: { ko: '수신', en: 'x'.repeat(501) } },
  ])('rejects malformed narrative fields: %j', (invalid) => {
    expect(parsePublicEventRow({ id: 'invalid', data: JSON.stringify({ ...eventData, ...invalid }) }, [])).toBeNull();
  });

  it('tells whether an event takes guest codes, from hidden rows too, without exposing any code', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    const events = toPublicEvents(
      [{ id: 'coded', data: JSON.stringify(eventData) }, { id: 'uncoded', data: JSON.stringify(eventData) }],
      [
        { id: 'host', eventId: 'coded', data: JSON.stringify({ ...artistData, status: 'PENDING', guestCode: 'HOST-CODE', guestLimit: 30 }) },
        { id: 'a1', eventId: 'uncoded', data: JSON.stringify(artistData) },
      ],
      now,
    );
    expect(events.map((event) => [event.id, event.guestAccess])).toEqual([['coded', true], ['uncoded', false]]);
    expect(JSON.stringify(events)).not.toContain('HOST-CODE');
    expect(JSON.stringify(events)).not.toContain('guestLimit');
  });

  it('lists only announced artists, while a hidden row still has to be well formed', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    const rows = (hidden: object) => toPublicEvents(
      [{ id: 'e', data: JSON.stringify(eventData) }],
      [
        { id: 'shown', eventId: 'e', data: JSON.stringify(artistData) },
        { id: 'next', eventId: 'e', data: JSON.stringify(hidden) },
      ],
      now,
    );
    const [event] = rows({ ...artistData, name: 'NOT YET', status: 'PENDING' });
    expect(event.artists.map((artist) => artist.id)).toEqual(['shown']);
    expect(JSON.stringify(event)).not.toContain('NOT YET');
    expect(rows({ name: 'BROKEN', status: 'PENDING' })).toEqual([]);
  });
});
