import { describe, expect, it, vi } from 'vitest';
import {
  formatEventDate,
  getDefaultEvent,
  getEventBoundaryTimes,
  getEventDateTime,
  getEventEndTime,
  getEffectiveEventStatus,
  getFutureUpcomingEvent,
  getLiveEvents,
  getRequestWindowState,
  getSlotTimes,
  isValidEventDateTime,
  selectEvent,
} from '../lib/events/lifecycle';
import type { EventStatus, TerminalEvent } from '../lib/events/types';
import { dayMark, eventSubtitle, sessionShort, venueMapHref } from '../features/events/model';
import { calendarSubscribeHref, sessionsCalendar } from '../features/events/calendar';

function event(id: string, date: string, time: string, status: EventStatus): TerminalEvent {
  return {
    id,
    session: id,
    subtitle: 'test',
    date,
    time,
    venue: 'test',
    district: 'test',
    coords: 'test',
    capacity: 'test',
    sound: 'test',
    status,
    artists: [],
  };
}

describe('event lifecycle', () => {
  const now = new Date('2026-08-11T12:00:00+09:00');

  it('archives an elapsed UPCOMING event but preserves LIVE without an end-time', () => {
    const pastUpcoming = event('past', '2026-08-10', '23:00 KST', 'UPCOMING');
    const live = event('live', '2026-08-10', '23:00 KST', 'LIVE');

    expect(getEffectiveEventStatus(pastUpcoming, now)).toBe('ARCHIVED');
    expect(getEffectiveEventStatus(live, now)).toBe('LIVE');
  });

  it('chooses the earliest future UPCOMING event regardless of source order', () => {
    const later = event('later', '2026-09-10', '23:00 KST', 'UPCOMING');
    const earlier = event('earlier', '2026-08-12', '23:00 KST', 'UPCOMING');
    const stale = event('stale', '2026-08-10', '23:00 KST', 'UPCOMING');

    expect(getFutureUpcomingEvent([later, stale, earlier], now)?.id).toBe('earlier');
  });

  it('prioritizes LIVE and exposes every live event in deterministic order', () => {
    const olderLive = event('older-live', '2026-08-10', '23:00 KST', 'LIVE');
    const liveB = event('live-b', '2026-08-11', '10:00 KST', 'LIVE');
    const liveA = event('live-a', '2026-08-11', '10:00 KST', 'LIVE');
    const upcoming = event('upcoming', '2026-08-12', '23:00 KST', 'UPCOMING');
    const events = [upcoming, olderLive, liveB, liveA];

    expect(getDefaultEvent(events, now)?.id).toBe('live-a');
    expect(getDefaultEvent([olderLive], now)?.id).toBe('older-live');
    expect(getLiveEvents(events, now).map(({ id }) => id)).toEqual(['live-a', 'live-b', 'older-live']);
    expect(events.map(({ id }) => id)).toEqual(['upcoming', 'older-live', 'live-b', 'live-a']);
  });

  it('falls back through upcoming, latest archive, and empty while honoring a valid URL selection', () => {
    const oldArchive = event('old', '2026-07-01', '23:00 KST', 'ARCHIVED');
    const elapsed = event('elapsed', '2026-08-10', '23:00 KST', 'UPCOMING');
    const later = event('later', '2026-09-10', '23:00 KST', 'UPCOMING');
    const earlier = event('earlier', '2026-08-12', '23:00 KST', 'UPCOMING');
    const events = [oldArchive, later, elapsed, earlier];

    expect(getDefaultEvent(events, now)?.id).toBe('earlier');
    expect(selectEvent(events, 'old', now)?.id).toBe('old');
    expect(selectEvent(events, 'missing', now)?.id).toBe('earlier');
    expect(getDefaultEvent([oldArchive, elapsed], now)).toMatchObject({ id: 'elapsed', status: 'ARCHIVED' });
    expect(getDefaultEvent([], now)).toBeNull();
  });

  it('closes the request window as soon as an event begins', () => {
    const started = event('started', '2026-08-11', '12:00 KST', 'UPCOMING');
    const oneMinuteAfterStart = new Date('2026-08-11T12:01:00+09:00');

    const window = getRequestWindowState(started, 30, oneMinuteAfterStart);
    expect(window.isElapsed).toBe(true);
    expect(window.isActive).toBe(false);
    expect(window.daysUntil).toBeLessThan(0);
    expect(getEffectiveEventStatus(started, now)).toBe('ARCHIVED');
    expect(getRequestWindowState(started, 30, now).isActive).toBe(false);
  });

  it('identifies request opening and event start as the only scheduled policy boundaries', () => {
    const upcoming = event('upcoming', '2026-09-10', '12:00 KST', 'UPCOMING');
    const live = event('live', '2026-08-10', '23:00 KST', 'LIVE');
    const opensAt = new Date('2026-08-11T12:00:00+09:00');
    const startsAt = getEventDateTime(upcoming);

    expect(getEventBoundaryTimes([live, upcoming], 30)).toEqual([opensAt.getTime(), startsAt.getTime()]);
    expect(getEventBoundaryTimes([upcoming])).toEqual([startsAt.getTime()]);
    expect(getRequestWindowState(upcoming, 30, new Date(opensAt.getTime() - 1)).isActive).toBe(false);
    expect(getRequestWindowState(upcoming, 30, opensAt).isActive).toBe(true);
  });

  it('fails closed when a scheduled event has an invalid date', () => {
    const invalid = event('invalid', 'not-a-date', '23:00 KST', 'UPCOMING');

    expect(getEffectiveEventStatus(invalid, now)).toBe('ARCHIVED');
    expect(getRequestWindowState(invalid, 30, now)).toMatchObject({
      isElapsed: true,
      isActive: false,
      opensInDays: null,
    });
  });

  it.each([
    ['2026-02-29', '23:00 KST'],
    ['2026-02-31', '23:00 KST'],
    ['2100-02-29', '23:00 KST'],
    ['2026-04-31', '23:00 KST'],
    ['2026-13-01', '23:00 KST'],
    ['2026-08-11', '24:00 KST'],
    ['2026-08-11', '23:60 KST'],
  ])('rejects invalid calendar or time values: %s %s', (date, time) => {
    const invalid = event('invalid', date, time, 'UPCOMING');
    expect(isValidEventDateTime(invalid)).toBe(false);
    expect(getRequestWindowState(invalid, 30, now).isActive).toBe(false);
  });

  it('accepts valid leap dates and preserves the existing optional KST suffix', () => {
    expect(getEventDateTime({ date: '2000-02-29', time: '00:00 KST' }).toISOString()).toBe('2000-02-28T15:00:00.000Z');
    expect(getEventDateTime({ date: '2028-02-29', time: '23:59' }).toISOString()).toBe('2028-02-29T14:59:00.000Z');
  });

  it.each(['UTC', 'America/Los_Angeles', 'Asia/Seoul'])('formats the same KST calendar date in host timezone %s', (timezone) => {
    vi.stubEnv('TZ', timezone);
    try {
      const midnight = event('midnight', '2026-09-08', '00:30 KST', 'UPCOMING');
      expect(formatEventDate(midnight, 'en-US')).toBe('Sep 08, 2026');
      expect(formatEventDate(midnight, 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })).toBe('2026년 9월 8일');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('event end and running order', () => {
  const kst = (value: string) => new Date(`${value}+09:00`);
  const slot = (id: string, time: string, status: TerminalEvent['artists'][number]['status'] = 'CONFIRMED') =>
    ({ id, name: id, origin: 'KR', dock: '1', time, status });
  const night = { ...event('TRM-03', '2026-11-28', '23:00 KST', 'UPCOMING'), endTime: '05:00' };

  it('runs an event from its start to its end time, then archives it', () => {
    expect(getEffectiveEventStatus(night, kst('2026-11-28T22:59:59'))).toBe('UPCOMING');
    expect(getEffectiveEventStatus(night, kst('2026-11-28T23:00:00'))).toBe('LIVE');
    expect(getEffectiveEventStatus(night, kst('2026-11-29T04:59:59'))).toBe('LIVE');
    expect(getEffectiveEventStatus(night, kst('2026-11-29T05:00:00'))).toBe('ARCHIVED');
    // The home plate shows the night as it runs, not as the last session.
    expect(getDefaultEvent([night], kst('2026-11-29T00:30:00'))).toMatchObject({ id: 'TRM-03', status: 'LIVE' });
    // Guest requests still close at the start.
    expect(getRequestWindowState(night, 30, kst('2026-11-28T23:00:00')).isActive).toBe(false);
  });

  it('archives a stored LIVE event once its end has passed', () => {
    const live = { ...night, status: 'LIVE' as const };
    expect(getEffectiveEventStatus(live, kst('2026-11-28T21:00:00'))).toBe('LIVE');
    expect(getEffectiveEventStatus(live, kst('2026-11-29T05:00:00'))).toBe('ARCHIVED');
  });

  it('takes the end from the last published slot when every published slot has its times', () => {
    const order = { ...event('TRM-02', '2026-05-08', '23:00 KST', 'UPCOMING'), artists: [
      slot('A', '23:00 - 01:00'), slot('B', '01:00 - 03:00'), slot('C', '03:00 - 05:00'),
      slot('D', '00:00 - 02:00'), slot('E', '02:00–04:00'), slot('HIDDEN', 'TBA', 'CLASSIFIED'),
    ] };
    expect(getEventEndTime(order)?.toISOString()).toBe(kst('2026-05-09T05:00:00').toISOString());
    expect(getEffectiveEventStatus(order, kst('2026-05-09T04:00:00'))).toBe('LIVE');
    // An end time in the data wins over the running order.
    expect(getEventEndTime({ ...order, endTime: '06:00 KST' })?.toISOString()).toBe(kst('2026-05-09T06:00:00').toISOString());
    // One published slot still TBA: the end is not known, so the start archives it as before.
    const partial = { ...order, artists: [...order.artists, slot('F', 'TBA')] };
    expect(getEventEndTime(partial)).toBeNull();
    expect(getEffectiveEventStatus(partial, kst('2026-05-09T00:00:00'))).toBe('ARCHIVED');
  });

  it('places each slot in the night of its event', () => {
    const at = (time: string) => {
      const times = getSlotTimes(night, time);
      return times && [times.start.toISOString(), times.end.toISOString()];
    };
    expect(at('23:30 - 00:30')).toEqual([kst('2026-11-28T23:30:00').toISOString(), kst('2026-11-29T00:30:00').toISOString()]);
    expect(at('05:00 - 07:00')).toEqual([kst('2026-11-29T05:00:00').toISOString(), kst('2026-11-29T07:00:00').toISOString()]);
    // A set before the doors stays on the same evening.
    expect(at('22:00 - 23:00')).toEqual([kst('2026-11-28T22:00:00').toISOString(), kst('2026-11-28T23:00:00').toISOString()]);
    expect(at('TBA')).toBeNull();
    expect(at('23:00')).toBeNull();
  });

  it('wakes the page when an event ends and when each slot starts and ends', () => {
    const live = { ...night, status: 'LIVE' as const, artists: [slot('A', '23:00 - 01:00'), slot('B', '01:00 - 03:00')] };
    expect(getEventBoundaryTimes([live], 30)).toEqual(
      ['2026-11-28T23:00:00', '2026-11-29T01:00:00', '2026-11-29T03:00:00', '2026-11-29T05:00:00'].map((time) => kst(time).getTime()),
    );
  });
});

describe('session marks and hand-offs', () => {
  it('counts D-day in KST calendar days, not hours left', () => {
    const night = event('A', '2026-11-28', '23:00 KST', 'UPCOMING');
    // Same day, 01:00 KST: the session is tonight.
    expect(dayMark(night, new Date('2026-11-27T16:00:00Z'))).toBe('D-DAY');
    // 01:00 KST the day before: one calendar day, though 46 hours remain.
    expect(dayMark(night, new Date('2026-11-26T16:00:00Z'))).toBe('D-1');
    // 23:30 KST the day before: still D-1, not D-DAY.
    expect(dayMark(night, new Date('2026-11-27T14:30:00Z'))).toBe('D-1');
    expect(dayMark({ ...night, status: 'LIVE' }, new Date())).toBe('LIVE');
    expect(dayMark(event('B', '2026-02-30', '23:00', 'UPCOMING'), new Date())).toBe('TBA');
  });

  it('shortens a titled session name for narrow slots', () => {
    expect(sessionShort('TERMINAL [03] : Interstellar Junction')).toBe('TERMINAL [03]');
    expect(sessionShort('TERMINAL [04]')).toBe('TERMINAL [04]');
    expect(sessionShort('A:B')).toBe('A:B');
  });

  it("takes a session's subtitle from its name, never TERMINAL's tagline", () => {
    expect(eventSubtitle({ session: 'TERMINAL [03] : Interstellar Junction', subtitle: 'A Voyage to the Unknown Sector.' })).toBe('Interstellar Junction');
    expect(eventSubtitle({ session: 'TERMINAL [04]', subtitle: 'A Voyage to the Unknown Sector.' })).toBe('');
    expect(eventSubtitle({ session: 'TERMINAL [04]', subtitle: 'Deep Field' })).toBe('Deep Field');
  });

  it('looks the venue up on Google Maps by name, and not an undisclosed one', () => {
    expect(venueMapHref({ venue: 'FAUST SEOUL', district: 'YONGSAN-GU // ITAEWON' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=FAUST%20SEOUL%20YONGSAN-GU%20ITAEWON');
    expect(venueMapHref({ venue: 'TBA', district: 'SEOUL' })).toBeNull();
    expect(venueMapHref({ venue: '  ', district: 'SEOUL' })).toBeNull();
  });

  it('writes every session into one subscription feed with stable ids and escaped text', () => {
    const ics = sessionsCalendar(
      [
        { ...event('TRM-03', '2026-11-28', '23:00 KST', 'UPCOMING'), session: 'LUMO; NIGHT', subtitle: 'A\\B', venue: 'FAUST SEOUL', district: 'YONGSAN-GU, ITAEWON' },
        { ...event('TRM-02', '2026-05-08', '23:00', 'ARCHIVED'), session: 'TERMINAL [02]' },
        event('BAD', '2026-02-30', '23:00', 'UPCOMING'),
      ],
      'https://terminal.stann.kr',
      new Date('2026-10-01T00:00:00Z'),
    );
    const lines = ics.split('\r\n');
    expect(lines).toContain('X-WR-CALNAME:TERMINAL');
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines).toContain('UID:TRM-03@terminal.stann.kr');
    expect(lines).toContain('DTSTART:20261128T140000Z');
    expect(lines).toContain('SUMMARY:TERMINAL LUMO\\; NIGHT');
    expect(lines).toContain('SUMMARY:TERMINAL [02]');
    expect(lines).toContain('LOCATION:FAUST SEOUL\\, YONGSAN-GU\\, ITAEWON');
    expect(ics).toContain('DESCRIPTION:A\\\\B\\nhttps://terminal.stann.kr/events/TRM-03');
    expect(ics).not.toMatch(/^(DTEND|DURATION)[:;]/m);
    const ended = sessionsCalendar([{ ...event('TRM-04', '2026-12-31', '23:00 KST', 'UPCOMING'), endTime: '06:00' }], 'https://terminal.stann.kr', new Date('2026-10-01T00:00:00Z'));
    expect(ended.split('\r\n')).toContain('DTEND:20261231T210000Z');
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it('subscribes Apple calendars by webcal and others through Google Calendar', () => {
    expect(calendarSubscribeHref('https://terminal.stann.kr', true)).toBe('webcal://terminal.stann.kr/calendar.ics');
    expect(calendarSubscribeHref('https://terminal.stann.kr', false))
      .toBe('https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fterminal.stann.kr%2Fcalendar.ics');
  });
});
