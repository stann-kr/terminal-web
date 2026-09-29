'use client';
import { useEffect, type RefObject } from 'react';

const motionAllowed = () =>
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
  !window.matchMedia?.('(forced-colors: active)').matches;

/**
 * Plates power up as they arrive: every plate of the page (a grandchild of `main`) waits clipped
 * until it enters the viewport, then opens on the next sixteenth note after the one before it.
 * Without script, or with reduced motion, nothing is ever clipped.
 */
export function usePlateReveal(main: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = main.current;
    if (!root || typeof IntersectionObserver === 'undefined' || !motionAllowed()) return;
    const io = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const plate = entry.target as HTMLElement;
          plate.style.setProperty('--stagger', String(Math.min(order++, 6)));
          plate.dataset.reveal = 'in';
          io.unobserve(plate);
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    const seen = new WeakSet<Element>();
    let frame = 0;
    const scan = () => {
      frame = 0;
      for (const plate of root.querySelectorAll<HTMLElement>(':scope > :not(h1, [role]) > *')) {
        if (seen.has(plate)) continue;
        seen.add(plate);
        plate.dataset.reveal = 'pending';
        io.observe(plate);
      }
    };
    scan();
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan);
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      io.disconnect();
    };
  }, [main]);
}

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

/**
 * Smooth wheel: wheel input sets a target and the page glides to it, closing ~90% of the gap per
 * eighth note at 138 BPM. Keyboard, scrollbar, touch, zoom and horizontal input stay native, as
 * does any wheel over a field or an inner scroller; any outside scroll hands control back at once.
 */
export function useSmoothWheel() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!fine?.matches || !motionAllowed()) return;
    let target = window.scrollY;
    let current = target;
    let frame = 0;
    let last = 0;
    const limit = () => document.documentElement.scrollHeight - window.innerHeight;
    const step = (time: number) => {
      const dt = last ? Math.min(64, time - last) : 16;
      last = time;
      current += (target - current) * (1 - Math.pow(0.1, dt / 217));
      if (Math.abs(target - current) < 0.5) current = target;
      window.scrollTo(0, current);
      frame = current === target ? 0 : requestAnimationFrame(step);
      if (!frame) last = 0;
    };
    const ownsWheel = (start: EventTarget | null) => {
      for (let node = start as Element | null; node && node !== document.body; node = node.parentElement) {
        if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) return true;
        const overflow = getComputedStyle(node).overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return true;
      }
      return false;
    };
    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || ownsWheel(event.target)) return;
      event.preventDefault();
      if (!frame) target = current = window.scrollY;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.max(0, Math.min(limit(), target + event.deltaY * unit));
      if (!frame) frame = requestAnimationFrame(step);
    };
    const scroll = () => {
      if (frame && Math.abs(window.scrollY - current) > 2) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
      if (!frame) target = current = window.scrollY;
    };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('scroll', scroll);
    };
  }, []);
}
