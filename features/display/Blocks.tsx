import type { CSSProperties } from 'react';
import styles from './blocks.module.css';

type Motion = 'scan' | 'twinkle' | 'scan twinkle' | 'still';

/**
 * Decorative square cells: a lit cell travels across the grid (`scan`) and chosen cells blink at
 * staggered phases (`twinkle`). A 1000ms step makes the scan a seconds sweep.
 * Always aria-hidden; `tone` and `state` let a screen tie the colour to a real status.
 */
export function Blocks({
  cols,
  rows = 1,
  motion = 'scan twinkle',
  lit = [],
  accent = [],
  labels = false,
  tone = 'ice',
  state,
  step = 90,
  offset = 0,
  className = '',
}: {
  cols: number;
  rows?: number;
  motion?: Motion;
  /** Cells that stay filled. */
  lit?: readonly number[];
  /** Cells that blink in the accent colour. */
  accent?: readonly number[];
  /** Print a two-digit sequence number in every cell. */
  labels?: boolean;
  tone?: 'ice' | 'amber' | 'danger';
  state?: string;
  /** Milliseconds the scanning cell rests on each cell. */
  step?: number;
  /** Phase shift in milliseconds, so neighbouring instruments do not scan in lockstep. */
  offset?: number;
  className?: string;
}) {
  const count = cols * rows;
  return (
    <div
      aria-hidden="true"
      className={`${styles.blocks} ${className}`}
      data-motion={motion}
      data-tone={tone}
      data-state={state}
      data-labels={labels || undefined}
      style={{ '--cols': cols, '--count': count, '--step': `${step}ms`, '--offset': `${offset}ms` } as CSSProperties}
    >
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          data-lit={lit.includes(index) || undefined}
          data-accent={accent.includes(index) || undefined}
          // A fixed pseudo-random phase keeps twinkles irregular without runtime randomness.
          style={{ '--i': index, '--phase': (index * 7 + 3) % 11 } as CSSProperties}
        >
          {labels ? String(index + 1).padStart(2, '0') : null}
        </i>
      ))}
    </div>
  );
}
