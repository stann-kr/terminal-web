'use client';
import { useIsFetching } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import styles from './display.module.css';

export function DisplaySurface() {
  return <div className={styles.surface} aria-hidden="true"><div className={styles.grain}/><div className={styles.sweep}/></div>;
}

export function DataActivity() {
  const fetching = useIsFetching() > 0;
  const label = fetching ? '기록을 불러오는 중' : '조회 대기';
  return <span className={styles.activity} data-busy={fetching} role="img" aria-label={label} title={label}><i/><i/><i/></span>;
}

export function LiveValue({ value }: { value: string | number }) {
  return <span data-readout-live=""><span key={value} className={styles.value}>{value}</span></span>;
}

export function SignalText({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={styles.signalText} data-active={active}><i aria-hidden="true"/>{children}</span>;
}
