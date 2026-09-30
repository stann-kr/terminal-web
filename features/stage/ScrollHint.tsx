'use client';
import { useEffect, useState } from 'react';
import styles from './stage.module.css';

/** Share of the window's height scrolled after which the cue has done its job for this view. */
const DISMISS_AT = 0.3;

/**
 * A cue at the foot of the window while the view has sheets below the one in sight, whether the
 * window started that way or was resized into it. Pressing it turns to the next sheet. Once the
 * visitor has scrolled a way into the view it leaves for good (the stage remounts it per view).
 */
export function ScrollHint({ active }: { active: boolean }) {
  const [below, setBelow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const root = document.documentElement;
      setBelow(root.scrollHeight - (window.scrollY + window.innerHeight) > 24);
      if (window.scrollY > window.innerHeight * DISMISS_AT) setDismissed(true);
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
  const shown = active && below && !dismissed;
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
