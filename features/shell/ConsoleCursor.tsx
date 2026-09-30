'use client';
import { useEffect, useRef } from 'react';
import styles from './shell.module.css';

const INTERACTIVE = 'a[href], button:not(:disabled), summary, label, select, [role=button], input[type=checkbox]';
const TEXT = 'input:not([type=checkbox]), textarea, [contenteditable=true]';

/**
 * The console's own pointer: a point that sits exactly on the pointer and a ring that trails it
 * on a damped follow. Over a control the ring opens and turns gold; pressing closes it; over a
 * text field the system caret takes over. Fine pointers only; decorative for assistive tech.
 */
export function ConsoleCursor() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cursor = root.current;
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const contrast = window.matchMedia?.('(forced-colors: active)');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!cursor || !fine?.matches || contrast?.matches) return;
    const html = document.documentElement;
    const dot = cursor.firstElementChild as HTMLElement;
    const ring = cursor.lastElementChild as HTMLElement;
    const target = { x: -100, y: -100 };
    const trail = { x: -100, y: -100 };
    let frame = 0;
    let last = 0;

    const tick = (time: number) => {
      // Frame-rate independent damping: the ring closes ~90% of the gap every 90ms, a light trail.
      const dt = last ? Math.min(64, time - last) : 16;
      last = time;
      const follow = reduced?.matches ? 1 : 1 - Math.pow(0.1, dt / 90);
      trail.x += (target.x - trail.x) * follow;
      trail.y += (target.y - trail.y) * follow;
      ring.style.translate = `${trail.x}px ${trail.y}px`;
      frame = Math.hypot(target.x - trail.x, target.y - trail.y) > 0.1 ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      target.x = event.clientX;
      target.y = event.clientY;
      dot.style.translate = `${target.x}px ${target.y}px`;
      if (cursor.dataset.visible !== 'true') {
        trail.x = target.x;
        trail.y = target.y;
        cursor.dataset.visible = 'true';
      }
      const element = event.target as Element | null;
      cursor.dataset.mode = element?.closest?.(TEXT) ? 'text' : element?.closest?.(INTERACTIVE) ? 'control' : 'idle';
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = () => { cursor.dataset.visible = 'false'; };
    const down = () => { cursor.dataset.pressed = 'true'; };
    const up = () => { delete cursor.dataset.pressed; };

    html.dataset.cursor = 'console';
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      cancelAnimationFrame(frame);
      delete html.dataset.cursor;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  return (
    <div ref={root} className={styles.cursor} aria-hidden="true" data-visible="false" data-mode="idle">
      <i className={styles.cursorDot} />
      <i className={styles.cursorRing} />
    </div>
  );
}
