import type { CSSProperties } from 'react';
import styles from './instruments.module.css';

/**
 * Printed scale with minor/major ticks. `marker` adds a caret that sweeps the scale;
 * `labels` prints the major positions as a decorative sequence, never as a measurement.
 */
export function Ticks({
  count = 40,
  major = 5,
  labels = false,
  marker = false,
  vertical = false,
  className = '',
}: {
  count?: number;
  major?: number;
  labels?: boolean;
  marker?: boolean;
  vertical?: boolean;
  className?: string;
}) {
  const majors = Math.floor(count / major) + 1;
  return (
    <div
      aria-hidden="true"
      className={`${styles.ticks} ${className}`}
      data-vertical={vertical || undefined}
      style={{ '--count': count, '--major': major } as CSSProperties}
    >
      <span className={styles.scale} />
      {labels && (
        <span className={styles.tickLabels}>
          {Array.from({ length: majors }, (_, index) => (
            <b key={index}>{String(index * major).padStart(2, '0')}</b>
          ))}
        </span>
      )}
      {marker && <i className={styles.caret} />}
    </div>
  );
}

/** Corner brackets and outer registration crosses for a focal window (parent must be positioned). */
export function Corners({ crosses = false }: { crosses?: boolean }) {
  return (
    <span aria-hidden="true" className={styles.corners} data-crosses={crosses || undefined}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** A printed bar code derived from `value`; it is ornament, not a scannable or secure code. */
export function Barcode({ value, className = '' }: { value: string; className?: string }) {
  const bars: { x: number; w: number }[] = [];
  let seed = 7;
  for (const char of value) seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  let x = 0;
  for (let index = 0; x < 120; index++) {
    seed = (seed * 73 + 19) % 9973;
    const width = 1 + (seed % 3);
    if (index % 2 === 0) bars.push({ x, w: width });
    x += width + (seed % 2);
  }
  return (
    <svg aria-hidden="true" className={`${styles.barcode} ${className}`} viewBox="0 0 120 24" preserveAspectRatio="none" focusable="false">
      {bars.map(bar => <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="24" />)}
    </svg>
  );
}

/**
 * Oscilloscope trace over a graticule. The trace scrolls continuously; `state` raises the
 * amplitude while a real request is active and flattens it on failure.
 */
export function Scope({ state = 'idle', className = '' }: { state?: string; className?: string }) {
  const points = Array.from({ length: 121 }, (_, index) => {
    const x = index * 2.5;
    // Whole periods per 60 samples, so the half-width scroll loops without a seam.
    const y = 20 - Math.sin((Math.PI * 2 * 3 * index) / 60) * 7 - Math.sin((Math.PI * 2 * 8 * index) / 60) * 2.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div aria-hidden="true" className={`${styles.scope} ${className}`} data-state={state}>
      <svg viewBox="0 0 300 40" preserveAspectRatio="none" focusable="false">
        <g className={styles.trace}>
          <polyline points={points} />
        </g>
      </svg>
    </div>
  );
}
