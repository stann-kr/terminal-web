'use client';
import { BrandText } from '@/features/ui/Ui';
import styles from './stage.module.css';

/**
 * What a first visit sees while the console gets ready (web fonts, the window measured and tiled,
 * the content language, the first read of the events). It is part of the server's first markup, so
 * the field covers the stage at once; its words show only if the wait passes 0.6s. It fades when the
 * stage is ready, and never shows without script.
 */
export function BootScreen({ done }: { done: boolean }) {
  return (
    <div className={styles.boot} data-done={done || undefined} aria-hidden={done || undefined}>
      <p className={styles.bootMark} aria-hidden="true">
        <BrandText text="TERMINAL" />
      </p>
      <p className={styles.bootLine} role="status">
        <i aria-hidden="true" />
        <span aria-hidden="true">Loading</span>
        <span className={styles.srOnly}>화면을 준비하는 중</span>
      </p>
    </div>
  );
}
