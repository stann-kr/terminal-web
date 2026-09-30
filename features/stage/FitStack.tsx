'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { whenFontsReady } from './text';
import { useStageMode } from './usePaging';

/**
 * A plate built of sub-plates stacked flush, each marked with `data-priority` (0 always stays; a
 * higher number folds first). On the stage the stack never overflows and never clips: every
 * sub-plate is measured at the plate's real size before the frame paints, and while they do not
 * fit, the least important one folds away. Off the stage everything shows.
 */
export function FitStack({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'span' }) {
  const ref = useRef<HTMLElement>(null);
  const mode = useStageMode();

  useLayoutEffect(() => {
    const stack = ref.current;
    if (!stack) return;
    const parts = () => [...stack.querySelectorAll<HTMLElement>(':scope > [data-priority]')];
    const fit = () => {
      for (const part of parts()) part.hidden = false;
      if (mode !== 'stage') return;
      const folding = parts()
        .filter(part => Number(part.dataset.priority) > 0)
        .sort((a, b) => Number(b.dataset.priority) - Number(a.dataset.priority));
      // Fold the least important part until the stack's content fits its own height.
      for (const part of folding) {
        if (stack.scrollHeight <= stack.clientHeight + 1) break;
        part.hidden = true;
      }
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(stack);
    const stop = whenFontsReady(fit);
    return () => {
      observer?.disconnect();
      stop();
    };
  });

  return (
    <Tag ref={ref as never} className={className} data-fit="">
      {children}
    </Tag>
  );
}
