'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import styles from './stage.module.css';

/** Share of the way from the rings' home to the pointer that their centre travels. */
const FOLLOW = 0.35;
/** Share of the remaining distance covered each frame: a slow, damped drift. */
const EASE = 0.04;

/**
 * Concentric rings behind a plate's content, drifting outward slowly. Their centre sits at `at`
 * (fractions of the plate) and leans after the pointer wherever it is on the page, catching up
 * slowly. Still for reduced motion, touch-only pointers and forced colours.
 *
 * `under`: drawn inside a card (which isolates), between the card's hover fill and its print, so the
 * rings stay while the card is lit and take its lit ink.
 */
export function Rings({ at, under = false }: { at: { x: number; y: number }; under?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    const quiet = '(prefers-reduced-motion: reduce), (forced-colors: active), not (pointer: fine)';
    if (!element || (window.matchMedia?.(quiet).matches ?? true)) return;
    let pointer: { x: number; y: number } | null = null;
    let current: { x: number; y: number } | null = null;
    let frame = 0;
    const step = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const home = { x: rect.width * at.x, y: rect.height * at.y };
      const goal = pointer
        ? {
            x: Math.min(rect.width, Math.max(0, home.x + (pointer.x - rect.left - home.x) * FOLLOW)),
            y: Math.min(rect.height, Math.max(0, home.y + (pointer.y - rect.top - home.y) * FOLLOW)),
          }
        : home;
      current ??= home;
      current = { x: current.x + (goal.x - current.x) * EASE, y: current.y + (goal.y - current.y) * EASE };
      element.style.setProperty('--rx', `${current.x.toFixed(1)}px`);
      element.style.setProperty('--ry', `${current.y.toFixed(1)}px`);
      if (Math.abs(goal.x - current.x) + Math.abs(goal.y - current.y) > 0.5) frame = requestAnimationFrame(step);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      kick();
    };
    const leave = () => {
      pointer = null;
      kick();
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('resize', kick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', kick);
    };
  }, [at.x, at.y]);
  const home = { '--rx': `${at.x * 100}%`, '--ry': `${at.y * 100}%` } as CSSProperties;
  return <i ref={ref} className={styles.rings} style={home} data-under={under || undefined} aria-hidden="true" />;
}
