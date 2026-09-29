'use client';
import { useEffect, type RefObject } from 'react';

type Connection = EventTarget & { saveData?: boolean };

/**
 * Marks the display root with `data-display-paused` whenever motion must stop:
 * FX OFF, reduced motion, forced colors, save-data or a hidden tab.
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
      const paused = element.hasAttribute('data-effects-off') || !!reduced?.matches || !!contrast?.matches || !!connection?.saveData || document.visibilityState === 'hidden';
      element.toggleAttribute('data-display-paused', paused);
    };
    const observer = new MutationObserver(update);
    update();
    observer.observe(element, { attributes: true, attributeFilter: ['data-effects-off'] });
    document.addEventListener('visibilitychange', update);
    reduced?.addEventListener('change', update);
    contrast?.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      reduced?.removeEventListener('change', update);
      contrast?.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
      element.removeAttribute('data-display-paused');
    };
  }, [root]);
}
