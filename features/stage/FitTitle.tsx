'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { defaultMeasurer, fitTitle, fontOf, whenFontsReady } from './text';
import styles from './stage.module.css';

/**
 * A title set as large as its box allows: the CSS size is the ceiling, and pretext finds the
 * largest size at which the text keeps to `maxLines` lines of the real width. Without measurement
 * (server, tests) it keeps the CSS size.
 */
export function FitTitle({
  text,
  children,
  maxLines = 2,
  minPx = 16,
  as: Tag = 'p',
  className = '',
  id,
  heading,
}: {
  text: string;
  children?: ReactNode;
  maxLines?: number;
  minPx?: number;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span';
  className?: string;
  id?: string;
  /** Marks the view's title: focus lands here after a state change. */
  heading?: boolean;
}) {
  const outer = useRef<HTMLElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = outer.current;
    const measurer = defaultMeasurer();
    if (!element || !measurer) return;
    const run = () => {
      const style = getComputedStyle(element);
      const ceiling = parseFloat(style.fontSize);
      // Letter spacing is given as `--title-ls` in em on the inner line, so it scales with the fit.
      const spacing = parseFloat(style.getPropertyValue('--title-ls')) || 0;
      const shown = style.textTransform === 'uppercase' ? text.toUpperCase() : text;
      // A little slack: the brand word is set in another face than the one measured.
      const width = element.clientWidth * (text.includes('TERMINAL') ? 0.94 : 0.99);
      setSize(fitTitle(shown, {
        font: px => fontOf(style, px),
        width,
        maxLines,
        minPx: Math.min(minPx, ceiling),
        maxPx: ceiling,
        letterSpacingEm: spacing,
      }, measurer));
    };
    run();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    observer?.observe(element);
    const stop = whenFontsReady(run);
    return () => {
      observer?.disconnect();
      stop();
    };
  }, [text, maxLines, minPx]);
  return (
    <Tag
      ref={outer as never}
      id={id}
      className={`${styles.fitTitle} ${className}`}
      tabIndex={heading ? -1 : undefined}
      data-stage-title={heading || undefined}
    >
      <span style={size === null ? undefined : { fontSize: `${size}px` }}>{children ?? text}</span>
    </Tag>
  );
}
