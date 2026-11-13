'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { whenFontsReady } from './text';
import { useStageMode, type StageRenderMode } from './usePaging';

/** Shows every part, then, on the stage, folds the least important ones until the stack fits. */
function fitStack(stack: HTMLElement, mode: StageRenderMode) {
  const parts = () => [...stack.querySelectorAll<HTMLElement>(':scope > [data-priority]')];
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
}

/**
 * A plate built of sub-plates stacked flush, each marked with `data-priority` (0 always stays; a
 * higher number folds first). On the stage the stack never overflows and never clips: every
 * sub-plate is measured at the plate's real size before the frame paints, and while they do not
 * fit, the least important one folds away. Off the stage everything shows.
 */
export function FitStack({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'span' }) {
  const ref = useRef<HTMLElement>(null);
  const mode = useStageMode();

  // Fitted again after every render (the content may have changed without the stack's size).
  useLayoutEffect(() => {
    if (ref.current) fitStack(ref.current, mode);
  });
  // A new size, or the web fonts arriving, fits it again; watched once per mode, not per render.
  useLayoutEffect(() => {
    const stack = ref.current;
    if (!stack) return;
    const refit = () => fitStack(stack, mode);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
    observer?.observe(stack);
    const stop = whenFontsReady(refit);
    return () => {
      observer?.disconnect();
      stop();
    };
  }, [mode]);

  return (
    <Tag ref={ref as never} className={className} data-fit="">
      {children}
    </Tag>
  );
}
