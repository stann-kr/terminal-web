'use client';
import { useEffect, useState } from 'react';
import styles from './stage.module.css';

/**
 * A cue at the foot of the window while the view has sheets below the one in sight, whether the
 * window started that way or was resized into it. Pressing it turns to the next sheet.
 */
export function ScrollHint({ active }: { active: boolean }) {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const root = document.documentElement;
      setBelow(root.scrollHeight - (window.scrollY + window.innerHeight) > 24);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [active]);
  const shown = active && below;
  return (
    <button
      type="button"
      className={styles.scrollHint}
      data-shown={shown || undefined}
      inert={!shown || undefined}
      aria-hidden={!shown || undefined}
      aria-label="아래 화면으로 내리기"
      onClick={() => {
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
        window.scrollBy({ top: window.innerHeight, behavior: still ? 'auto' : 'smooth' });
      }}
    >
      <i aria-hidden="true" />
      <i aria-hidden="true" />
    </button>
  );
}
