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
    // On a slow line the view has not changed yet when the hold is up: the link is still pending
    // (useNavigationPending), so it stays lit for another hold rather than going dark on nothing.
    const settle = () => {
      if (pressed?.hasAttribute('data-pending')) hold = window.setTimeout(settle, PRESS_HOLD_MS);
      else release();
    };
    const up = (event: PointerEvent) => {
      if (!pressed || hold || !event.isPrimary) return;
      window.clearTimeout(delay);
      light(pressed);
      hold = window.setTimeout(settle, PRESS_HOLD_MS);
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

/**
 * Whether the pending cover's LOADING line fits the box it covers: the link, or the row a static
 * link stretches its cover over. Read once the cover is on, from its own font; a box too small for
 * it shows the lamp alone (`data-pending=compact`) rather than a clipped word.
 */
export function loadingFits(link: HTMLElement) {
  const host = getComputedStyle(link).position === 'static' ? link.offsetParent : link;
  if (!(host instanceof HTMLElement)) return true;
  const label = getComputedStyle(link, '::after');
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return true;
  context.font = label.font;
  const text = label.content.replace(/^["']|["']$/g, '');
  const spacing = (parseFloat(label.letterSpacing) || 0) * text.length;
  const needed = context.measureText(text).width + spacing + (parseFloat(label.paddingLeft) || 0);
  return needed + 8 <= host.clientWidth;
}

/** A view that has not arrived by now will not: the link stops claiming it is on its way. */
export const PENDING_LIMIT_MS = 15000;

/**
 * Until the address changes, a link the router took over to go somewhere else gets
 * `data-pending` (and the page `data-navigating`): on a slow line the view can take seconds
 * to change, and without this the press would read as having missed. `location` is the
 * current path and query; when it changes the view has arrived and the marks go.
 */
export function useNavigationPending(location: string) {
  useEffect(() => {
    let pending: HTMLElement | null = null;
    let limit = 0;
    const clear = () => {
      window.clearTimeout(limit);
      pending?.removeAttribute('data-pending');
      pending = null;
      document.documentElement.removeAttribute('data-navigating');
    };
    const click = (event: MouseEvent) => {
      // The router prevents the default of the clicks it handles itself; anything else is the
      // browser's own navigation (new tab, download, outside link), which shows its own progress.
      if (!event.defaultPrevented) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self')) return;
      const to = new URL(link.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname + to.search === window.location.pathname + window.location.search) return;
      clear();
      pending = link;
      link.setAttribute('data-pending', '');
      if (!loadingFits(link)) link.setAttribute('data-pending', 'compact');
      document.documentElement.setAttribute('data-navigating', '');
      limit = window.setTimeout(clear, PENDING_LIMIT_MS);
    };
    document.addEventListener('click', click);
    return () => {
      clear();
      document.removeEventListener('click', click);
    };
  }, [location]);
}
