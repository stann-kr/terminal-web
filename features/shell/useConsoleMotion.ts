'use client';
import { useEffect } from 'react';

/**
 * Hover light-up sweeps in from the side the pointer came from: each control (and the row it
 * sits in) gets `--sweep`, a signed width the fill travels.
 */
export function useSweepDirection() {
  useEffect(() => {
    const mark = (event: PointerEvent) => {
      const control = (event.target as Element | null)?.closest?.('a, button');
      if (!control || control.contains(event.relatedTarget as Node | null)) return;
      for (const host of new Set([control, control.closest('li'), control.parentElement])) {
        if (!(host instanceof HTMLElement)) continue;
        const rect = host.getBoundingClientRect();
        const fromLeft = event.clientX < rect.left + rect.width / 2;
        host.style.setProperty('--sweep', `${(fromLeft ? 1 : -1) * Math.ceil(rect.width)}px`);
      }
    };
    document.addEventListener('pointerover', mark);
    return () => document.removeEventListener('pointerover', mark);
  }, []);
}

/** A finger resting this long on a link, without sliding, is pressing it rather than scrolling. */
export const PRESS_DELAY_MS = 80;
/** A finger that travels farther than this is scrolling: the press is let go. */
export const PRESS_SLOP_PX = 10;
/** A pressed link stays lit while the view changes, about as long as the boxes take to land. */
export const PRESS_HOLD_MS = 900;

/**
 * A touch screen has no hover, so a press shows instead: the link under a resting finger gets
 * `data-pressed` (and its row `--rise`, the height the fill climbs from the bottom edge). It
 * is not taken back when the finger lifts, which would read as a blink before the view changes;
 * it stays lit through the change and goes out once the boxes have landed. A finger that slides
 * or is taken over by scrolling lets the press go at once. Mouse pointers keep hover and `:active`.
 */
export function useTouchPress() {
  useEffect(() => {
    let pressed: HTMLElement | null = null;
    let start = { x: 0, y: 0 };
    let delay = 0;
    let hold = 0;
    const light = (link: HTMLElement) => {
      for (const host of new Set([link, link.closest('li'), link.parentElement])) {
        if (host instanceof HTMLElement) host.style.setProperty('--rise', `${-Math.ceil(host.getBoundingClientRect().height)}px`);
      }
      link.setAttribute('data-pressed', '');
    };
    const release = () => {
      window.clearTimeout(delay);
      window.clearTimeout(hold);
      delay = 0;
      hold = 0;
      pressed?.removeAttribute('data-pressed');
      pressed = null;
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      release();
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLElement)) return;
      pressed = link;
      start = { x: event.clientX, y: event.clientY };
      delay = window.setTimeout(() => light(link), PRESS_DELAY_MS);
    };
    const move = (event: PointerEvent) => {
      if (!pressed || hold || !event.isPrimary) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > PRESS_SLOP_PX) release();
    };
    const up = (event: PointerEvent) => {
      if (!pressed || hold || !event.isPrimary) return;
      window.clearTimeout(delay);
      light(pressed);
      hold = window.setTimeout(release, PRESS_HOLD_MS);
    };
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    return () => {
      release();
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', release);
    };
  }, []);
}
