'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Rect } from './layout';
import styles from './stage.module.css';

type Layer = { key: string; node: ReactNode };

const EXIT_MS = 120;

/**
 * Content that changes shape: when `id` changes, the old content fades out on top while the new
 * content fades in. Layers are keyed, so the outgoing content is the same live instance (never
 * remounted) showing what it last showed, and it is inert while it leaves.
 */
export function Swap({ id, children }: { id: string; children: ReactNode }) {
  // The last rendered content and the layers on their way out, both derived during render so a
  // swap paints in the same frame as the change that caused it.
  const [shown, setShown] = useState<Layer>({ key: id, node: children });
  const [leaving, setLeaving] = useState<Layer[]>([]);
  if (shown.key !== id) {
    setLeaving(list => [...list.filter(layer => layer.key !== id && layer.key !== shown.key), shown]);
    setShown({ key: id, node: children });
  } else if (shown.node !== children) {
    setShown({ key: id, node: children });
  }
  useLayoutEffect(() => {
    if (!leaving.length) return;
    const timer = window.setTimeout(() => setLeaving([]), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  const layers = [
    ...leaving.filter(layer => layer.key !== id).map(layer => ({ ...layer, out: true })),
    { key: id, node: children, out: false },
  ];
  return (
    <>
      {layers.map(layer => (
        <div
          key={layer.key}
          className={styles.layer}
          data-layer={layer.out ? 'leaving' : 'current'}
          inert={layer.out || undefined}
          aria-hidden={layer.out || undefined}
          data-fit={layer.out ? undefined : ''}
        >
          {layer.node}
        </div>
      ))}
    </>
  );
}

export interface BoxProps {
  /** Null in flow mode: the box is then an ordinary block in the document. */
  rect: Rect | null;
  visible: boolean;
  contentKey: string;
  children: ReactNode;
  className?: string;
  surface?: string;
  /** Delay before this box starts moving (rail stagger), in ms. */
  delay?: number;
  /** Arrival stagger index for the content. */
  order?: number;
  /** When set (a new token), the box first jumps to `rect` here, then travels to its place. */
  origin?: { token: number; rect: Rect } | null;
  as?: 'div' | 'section' | 'nav';
  label?: string;
  data?: Record<string, string | undefined>;
}

const place = (rect: Rect) => ({ transform: `translate(${rect.x}px, ${rect.y}px)`, width: `${rect.w}px`, height: `${rect.h}px` });

/**
 * A stage element: positioned by transform and size, never re-parented, so moving between states
 * is the same DOM node travelling. Its content is drawn at the arrival size (a window opening onto
 * it, not text re-wrapping every frame).
 */
export function Box({ rect, visible, contentKey, children, className = '', surface, delay = 0, order = 0, origin, as: Tag = 'div', label, data }: BoxProps) {
  const ref = useRef<HTMLElement>(null);
  const style = rect
    ? ({ ...place(rect), '--cw': `${rect.w}px`, '--ch': `${rect.h}px`, '--delay': `${delay}ms`, '--order': order } as CSSProperties)
    : ({ '--order': order } as CSSProperties);
  const token = origin?.token;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !origin || !rect) return;
    // FLIP: jump to where the click happened with transitions off, flush, then let it travel.
    const target = place(rect);
    const start = place(origin.rect);
    element.style.transition = 'none';
    Object.assign(element.style, start);
    void element.getBoundingClientRect();
    element.style.transition = '';
    Object.assign(element.style, target);
    // Only a new origin token replays this; later renders keep React's own style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Tag
      ref={ref as never}
      className={`${styles.box} ${className}`}
      style={style}
      data-surface={surface}
      data-visible={visible}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
      aria-label={label}
      {...Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => [`data-${key}`, value]))}
    >
      <Swap id={contentKey}>{children}</Swap>
    </Tag>
  );
}
