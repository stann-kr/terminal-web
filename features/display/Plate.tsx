import styles from './display.module.css';

export type Surface = 'sand' | 'mint' | 'teal' | 'signal' | 'slate';

/**
 * A flat colour plate that fills free wall space with a system label, like the panel faces around
 * a ship console. Always decorative: the words are station names and codes, never content.
 */
export function Plate({
  surface = 'slate',
  title,
  code,
  cross = false,
  hatch = false,
  className = '',
}: {
  surface?: Surface;
  title?: string;
  code?: string;
  cross?: boolean;
  hatch?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.plate} ${className}`}
      data-surface={hatch ? undefined : surface}
      data-hatch={hatch || undefined}
    >
      {title && <p className={styles.plateTitle}>{title}</p>}
      {cross && <i className={styles.cross} />}
      {code && <p className={styles.plateCode}>{code}</p>}
    </div>
  );
}
