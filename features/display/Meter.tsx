import type { CSSProperties } from 'react';
import styles from './display.module.css';

/**
 * A segmented bar that shows a real quantity (`value` of `segments` filled). `busy` pulses the
 * next segment while a real request is pending. Decorative for assistive tech: the number it
 * reflects is always printed as text next to it.
 */
export function Meter({
  segments,
  value,
  tone = 'ink',
  busy = false,
  className = '',
}: {
  segments: number;
  value: number;
  tone?: 'ink' | 'accent' | 'danger';
  busy?: boolean;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(segments, Math.round(value)));
  return (
    <span
      aria-hidden="true"
      className={`${styles.meter} ${className}`}
      data-tone={tone}
      data-busy={busy || undefined}
      style={{ '--segments': segments } as CSSProperties}
    >
      {Array.from({ length: segments }, (_, index) => (
        <i key={index} data-on={index < filled || undefined} data-next={index === filled || undefined} />
      ))}
    </span>
  );
}
