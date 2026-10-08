'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { defaultMeasurer, fitTitle, fontOf, whenFontsReady, wordReserveEm } from './text';
import styles from './stage.module.css';

/** The word BrandText sets in the brand face, and that face's letter spacing (ui.module.css `.brandWord`). */
const BRAND_WORD = 'TERMINAL';
const BRAND_SPACING_EM = 0.02;

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
      const font = (px: number) => fontOf(style, px);
      // The brand word is set in its own, wider face (BrandText), not the one measured: each line
      // keeps free what it takes beyond the title's face, so a title never breaks inside it.
      const brand = style.getPropertyValue('--brand').trim();
      const brandWords = shown.split(BRAND_WORD).length - 1;
      const reserveEm = brand && brandWords
        ? brandWords * wordReserveEm(BRAND_WORD, font, spacing, px => `400 ${px}px ${brand}`, BRAND_SPACING_EM, measurer)
        : 0;
      setSize(fitTitle(shown, {
        font,
        width: element.clientWidth * 0.99,
        maxLines,
        minPx: Math.min(minPx, ceiling),
        maxPx: ceiling,
        letterSpacingEm: spacing,
        reserveEm,
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
