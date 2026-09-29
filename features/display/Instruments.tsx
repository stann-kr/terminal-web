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
