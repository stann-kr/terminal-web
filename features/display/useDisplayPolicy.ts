'use client';
import { useEffect, type RefObject } from 'react';

type Connection = EventTarget & { saveData?: boolean };

/**
 * Marks the display root with `data-display-paused` whenever motion must stop:
 * reduced motion, forced colors, save-data or a hidden tab.
 * Runs after hydration only, so the server markup never carries the attribute.
 */
export function useDisplayPolicy(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = window.matchMedia?.('(forced-colors: active)');
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const update = () => {
      const paused = !!reduced?.matches || !!contrast?.matches || !!connection?.saveData || document.visibilityState === 'hidden';
      element.toggleAttribute('data-display-paused', paused);
    };
    update();
    document.addEventListener('visibilitychange', update);
    reduced?.addEventListener('change', update);
    contrast?.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      reduced?.removeEventListener('change', update);
      contrast?.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
      element.removeAttribute('data-display-paused');
    };
  }, [root]);
}
