'use client';
import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';

/** `boot` is the server and first client render, before the window has been measured. */
export type StageRenderMode = 'stage' | 'boot';
export const StageModeContext = createContext<StageRenderMode>('boot');
export const useStageMode = () => useContext(StageModeContext);

/** Wheel travel (px) that turns one page, and how long paging stays locked after a turn. */
export const WHEEL_STEP = 60;
export const WHEEL_LOCK_MS = 450;

const lineUnit = (event: WheelEvent) => (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);

export interface Turn {
  prev?: () => void;
  next?: () => void;
}

/**
 * Wheel turns pages instead of scrolling: travel adds up until it passes `WHEEL_STEP`, then one page
 * turns and paging rests for `WHEEL_LOCK_MS`, so a trackpad's momentum never flips several pages.
 * The event stops here, so a pager inside another pager owns its own wheel; past the last page the
 * wheel is left alone and the page snaps to the next sheet instead.
 */
export function useWheelPaging(ref: RefObject<HTMLElement | null>, turn: Turn, enabled: boolean, accept?: (target: Element) => boolean) {
  const latest = useRef({ turn, accept });
  useEffect(() => {
    latest.current = { turn, accept };
  });
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let travel = 0;
    let lockedUntil = 0;
    let idle = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const target = event.target as Element | null;
      if (!target || target.closest('textarea, select')) return;
      if (latest.current.accept && !latest.current.accept(target)) return;
      const { prev, next } = latest.current.turn;
      const forward = event.deltaY > 0;
      if (!(forward ? next : prev)) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(idle);
      idle = window.setTimeout(() => (travel = 0), 200);
      if (performance.now() < lockedUntil) return;
      travel += event.deltaY * lineUnit(event);
      if (Math.abs(travel) < WHEEL_STEP) return;
      travel = 0;
      lockedUntil = performance.now() + WHEEL_LOCK_MS;
      (forward ? next : prev)?.();
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      window.clearTimeout(idle);
      element.removeEventListener('wheel', wheel);
    };
  }, [ref, enabled]);
}

/** Keys that turn pages; none of them act while typing. */
export function pageKey(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'target'>): 'prev' | 'next' | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target as Element | null;
  if (target?.closest?.('input, textarea, select, [contenteditable=true]')) return null;
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') return 'prev';
  if (event.key === 'ArrowRight' || event.key === 'PageDown') return 'next';
  return null;
}

/** "3쪽 중 2쪽" for the live region; `02 / 03` is what the eye reads. */
export const pageAnnouncement = (page: number, pages: number) => `${pages}쪽 중 ${page}쪽`;
export const pageReadout = (page: number, pages: number) => `${String(page).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`;
