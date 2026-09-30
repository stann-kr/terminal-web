import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandText } from '@/features/ui/Ui';
import styles from './plates.module.css';

/**
 * The faces a plate wears besides its open content. Every face is a real link, so plates work with
 * the middle click, a new tab and a copied address like any page link.
 */

/** A rail slot: the plate's name large, its Korean name for assistive tech, one line of meta. */
export function RailFace({ href, name, title, meta, carrier }: { href: string | null; name: string; title: string; meta?: string; carrier?: string }) {
  const body = (
    <>
      <span className={styles.railName} aria-hidden="true">{name}</span>
      <span className={styles.railTitle}>{title}</span>
      {meta && <span className={styles.railMeta} aria-hidden="true">{meta}</span>}
    </>
  );
  if (!href) return <div className={styles.rail}>{body}</div>;
  return (
    <Link href={href} className={styles.rail} data-carrier={carrier} scroll={false}>
      {body}
    </Link>
  );
}

/**
 * A home plate's head. The title link stretches over the whole plate, so the plate is one target;
 * controls placed inside the plate sit above that stretch.
 */
export function TileHead({ href, label, title, chips, carrier }: { href: string; label: string; title: string; chips?: ReactNode; carrier?: string }) {
  return (
    <header className={styles.tileHead} data-fit="">
      <h2 className={styles.tileTitle}>
        <Link href={href} className={styles.stretch} data-carrier={carrier} scroll={false}>
          <span className={styles.tileLabel} aria-hidden="true">{label}</span>
          <span className={styles.tileKo}><BrandText text={title} /></span>
        </Link>
      </h2>
      {chips && <span className={styles.tileChips} aria-hidden="true">{chips}</span>}
    </header>
  );
}

/** An open plate's head: the view's h1 (focus lands on it), its printed name, and chips. */
export function FocusHead({ label, title, chips, children }: { label: string; title: string; chips?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.focusHead} data-fit="">
      <div className={styles.focusTitleRow}>
        <h1 className={styles.focusTitle} tabIndex={-1} data-stage-title="">
          <span className={styles.focusLabel} aria-hidden="true">{label}</span>
          <span className={styles.focusKo}><BrandText text={title} /></span>
        </h1>
        {chips && <span className={styles.focusChips} aria-hidden="true">{chips}</span>}
      </div>
      {children}
    </header>
  );
}

/** A parent plate folded above its open detail: its name, a count, and the way back to the list. */
export function StripFace({ href, label, title, meta, back }: { href: string; label: string; title: string; meta?: string; back: string }) {
  return (
    <div className={styles.strip}>
      <p className={styles.stripTitle}>
        <span className={styles.stripLabel} aria-hidden="true">{label}</span>
        <span>{title}</span>
      </p>
      {meta && <span className={styles.stripMeta} aria-hidden="true">{meta}</span>}
      <Link href={href} className={styles.stripBack} scroll={false}>
        {back}
      </Link>
    </div>
  );
}

/** Small printed tags for heads. */
export function Tags({ items }: { items: (string | false | null | undefined)[] }) {
  return (
    <>
      {items.filter(Boolean).map(item => (
        <span key={item as string} className={styles.tag}>{item}</span>
      ))}
    </>
  );
}
