'use client';
import { useIsFetching } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import styles from './display.module.css';

/** Status-line lamp for real query activity; it only blinks while a request is pending. */
export function DataActivity() {
  const fetching = useIsFetching() > 0;
  const label = fetching ? '기록을 불러오는 중' : '조회 대기';
  return (
    <span className={styles.activity} data-busy={fetching} role="img" aria-label={label} title={label}>
      <i />
      {fetching ? 'READ' : 'IDLE'}
    </span>
  );
}

/**
 * A readout that rolls like a mechanical counter: each character sits in its own window and only
 * the characters that changed drop in, so a ticking second rolls one digit, not the whole number.
 */
export function LiveValue({ value }: { value: string | number }) {
  return (
    <span className={styles.value}>
      {[...String(value)].map((glyph, index) => (
        <span key={index} className={styles.window}>
          <span key={glyph} className={styles.glyph}>{glyph}</span>
        </span>
      ))}
    </span>
  );
}

export function SignalText({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={styles.signalText} data-active={active}><i aria-hidden="true" />{children}</span>;
}
