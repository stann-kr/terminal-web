import type { CSSProperties } from 'react';
import styles from './ornament.module.css';

// Abstract display patterns; cell numbers are decorative indices, not event data.
export function Ornament({ variant = 'slots', compact = false, active = true }: {
  variant?: 'scan' | 'slots' | 'matrix';
  compact?: boolean;
  active?: boolean;
}) {
  const count = variant === 'matrix' ? 32 : compact ? 12 : 24;
  return <div aria-hidden="true" className={`${styles.ornament} ${styles[variant]} ${compact ? styles.compact : ''}`} data-active={active}>
    {variant === 'scan' ? <span className={styles.cursor}/> : Array.from({ length: count },(_,index) => {
      const dim = variant === 'matrix' ? index === 12 || index === 27 : [2,4,10,13,19,22].includes(index);
      const accent = variant === 'matrix' ? index === 8 || index === 23 : index === 7 || index === 8;
      return <span key={index} className={`${styles.cell} ${dim ? styles.dim : ''} ${accent ? styles.accent : ''}`} style={{ '--phase': `${index % 4 * -.7}s` } as CSSProperties}>
        {variant === 'matrix' && String(index+1).padStart(2,'0')}
      </span>;
    })}
  </div>;
}
