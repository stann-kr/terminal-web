'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Rect } from './layout';
import styles from './stage.module.css';

/** A content layer and the box size it was last drawn at. */
type Layer = { key: string; node: ReactNode; w?: number; h?: number };

/** Outlasts the exit fade (`--dur-exit`), so a leaving layer is only removed once it is invisible. */
const EXIT_MS = 300;

/**
 * Content that changes shape: when `id` changes, the old content fades out underneath while the new
 * content fades in over it, the two overlapping so the box is never an empty block. Layers are
 * keyed, so the outgoing content is the same live instance (never remounted) showing what it last
 * showed, and it is inert while it leaves. It keeps the size it was drawn at, so it never re-wraps:
 * the box's window closes or opens over it as it travels.
 */
function Swap({ id, w, h, children }: { id: string; w?: number; h?: number; children: ReactNode }) {
  // The last rendered content and the layers on their way out, both derived during render so a
  // swap paints in the same frame as the change that caused it.
  const [shown, setShown] = useState<Layer>({ key: id, node: children, w, h });
  const [leaving, setLeaving] = useState<Layer[]>([]);
  if (shown.key !== id) {
    setLeaving(list => [...list.filter(layer => layer.key !== id && layer.key !== shown.key), shown]);
    setShown({ key: id, node: children, w, h });
  } else if (shown.node !== children || shown.w !== w || shown.h !== h) {
    setShown({ key: id, node: children, w, h });
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
          style={layer.out && layer.w ? { width: `${layer.w}px`, height: `${layer.h}px` } : undefined}
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
  /**
   * The view this layout belongs to. When the view changes and the box changes size a lot, its
   * content fades out and is drawn afresh after the move, so a moving box carries no text across
   * the screen. Within one view (a window resize, a spill) content is never redrawn this way, so
   * nothing typed is lost.
   */
  view?: string;
  /**
   * Sub-plates: boxes that belong to this plate. They sit in the plate's own coordinates, so they
   * ride along when the plate moves and only re-tile inside it. They are never swapped out.
   */
  overlay?: ReactNode;
  /** Decoration drawn under the content (the rings), kept across content swaps. */
  decor?: ReactNode;
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
/** Share of width or height a box must change by, on a change of view, to redraw its content. */
const RESHAPE = 0.12;

export function Box({ rect, visible, contentKey, children, className = '', surface, delay = 0, order = 0, origin, as: Tag = 'div', label, data, view, overlay, decor }: BoxProps) {
  const ref = useRef<HTMLElement>(null);
  const [shape, setShape] = useState({ view, w: rect?.w ?? 0, h: rect?.h ?? 0, generation: 0 });
  if (rect && view !== shape.view) {
    const reshaped = Math.abs(rect.w - shape.w) > shape.w * RESHAPE || Math.abs(rect.h - shape.h) > shape.h * RESHAPE;
    setShape({ view, w: rect.w, h: rect.h, generation: shape.generation + (reshaped && shape.w > 0 ? 1 : 0) });
  }
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
      {decor}
      <Swap id={`${contentKey}:${shape.generation}`} w={rect?.w} h={rect?.h}>{children}</Swap>
      {overlay}
    </Tag>
  );
}
