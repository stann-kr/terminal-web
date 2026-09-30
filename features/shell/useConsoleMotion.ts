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
