'use client';
import { useEffect, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { CALENDAR_FEED_PATH, calendarSubscribeHref } from './calendar';
import { SITE_ORIGIN } from './metadata';

const noSubscribe = () => () => {};
/**
 * The subscribe link for this browser: `webcal:` on Apple devices, Google Calendar elsewhere. It
 * always names the public site, so a preview or development address never ends up subscribed.
 */
export function useSubscribeHref() {
  return useSyncExternalStore(
    noSubscribe,
    () => calendarSubscribeHref(SITE_ORIGIN, /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)),
    // The server cannot know the device; the feed itself stands in until hydration.
    () => `${SITE_ORIGIN}${CALENDAR_FEED_PATH}`,
  );
}

/** Browsers inside an app (Instagram, Facebook, KakaoTalk, LINE, NAVER) that drop a `webcal:` link without a word. */
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|KAKAOTALK|Line\/|NAVER\(inapp|DaumApps/i;
/** Longest the calendar key shows LOADING while the calendar app or the new tab takes over. */
export const CALENDAR_OPEN_MS = 2500;
/** Short, so the key keeps its size. */
export const CALENDAR_BLOCKED = 'Safari에서 열어 주세요';
type CalendarState = 'idle' | 'opening' | 'blocked';

/**
 * The calendar key hands off to another app (the calendar, or a new tab), which can take seconds and
 * shows nothing on the page meanwhile. So the key shows the loading cover until the page loses
 * focus or is hidden, or CALENDAR_OPEN_MS passes. A browser inside an app drops `webcal:` silently:
 * there the key says to open the page in Safari instead, for a moment, like the share key's result.
 */
export function useCalendarOpen(href: string) {
  const [state, setState] = useState<CalendarState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const done = () => setState('idle');
    const hidden = () => document.visibilityState === 'hidden' && done();
    const timer = window.setTimeout(done, state === 'blocked' ? 4000 : CALENDAR_OPEN_MS);
    if (state === 'opening') {
      window.addEventListener('blur', done);
      window.addEventListener('pagehide', done);
      document.addEventListener('visibilitychange', hidden);
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', done);
      window.removeEventListener('pagehide', done);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [state]);
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (href.startsWith('webcal:') && IN_APP.test(navigator.userAgent)) {
      event.preventDefault();
      setState('blocked');
      return;
    }
    setState('opening');
  }
  return [state, open] as const;
}
