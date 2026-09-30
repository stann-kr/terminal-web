import { describe, expect, it, vi } from 'vitest';
import {
  formatEventDate,
  getDefaultEvent,
  getEventBoundaryTimes,
  getEventDateTime,
  getEffectiveEventStatus,
  getFutureUpcomingEvent,
  getLiveEvents,
  getRequestWindowState,
  isValidEventDateTime,
  selectEvent,
} from '../lib/events/lifecycle';
import type { EventStatus, TerminalEvent } from '../lib/events/types';

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
