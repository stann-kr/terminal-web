import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandText } from '@/features/ui/Ui';
import styles from './plates.module.css';

/**
 * The faces a plate wears. One rule for pointing: a face with nothing else to press inside is one
 * link, and the whole face lights up; a face that holds other controls or carriers has a head band
 * that is the link, and only that band lights up. What lights up is exactly what is pressed.
 * Every face link is a real link (middle click, new tab and copied address work).
 */

/** A whole face that is a single link: chips, the back card, summary plates with nothing inside to press. */
export function CardLink({ href, className = '', label, carrier, children }: { href: string; className?: string; label?: string; carrier?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${styles.card} ${className}`} aria-label={label} data-carrier={carrier} scroll={false}>
      {children}
    </Link>
  );
}

/** A chip: the plate's name large, its Korean name, one line of meta. */
export function ChipFace({ href, name, title, meta, carrier }: { href: string | null; name: string; title: string; meta?: string; carrier?: string }) {
  const body = (
    <>
      <span className={styles.chipName} aria-hidden="true">{name}</span>
      <span className={styles.chipTitle}>{title}</span>
      {meta && <span className={styles.chipMeta} aria-hidden="true">{meta}</span>}
    </>
  );
  if (!href) return <div className={`${styles.card} ${styles.chip}`}>{body}</div>;
  return (
    <CardLink href={href} className={styles.chip} carrier={carrier}>
      {body}
    </CardLink>
  );
}

/** The printed name of a plate over its rule: English station name, Korean title, tags. */
function BandBody({ label, title, tags }: { label: string; title: string; tags?: ReactNode }) {
  return (
    <>
      <span className={styles.bandTitle}>
        <span className={styles.bandLabel} aria-hidden="true">{label}</span>
        <span className={styles.bandKo}><BrandText text={title} /></span>
      </span>
      {tags && <span className={styles.bandTags} aria-hidden="true">{tags}</span>}
    </>
  );
}

/**
 * A head band that is the plate's link (summary plates and indexes, whose carriers sit below it).
 * `data-head` marks where the carriers may start.
 */
export function HeadLink({ href, label, title, tags, heading = 'h2' }: { href: string; label: string; title: string; tags?: ReactNode; heading?: 'h2' | 'p' }) {
  const Tag = heading;
  return (
    <Tag className={styles.bandWrap} data-head="">
      <Link href={href} className={`${styles.band} ${styles.bandLink}`} scroll={false}>
        <BandBody label={label} title={title} tags={tags} />
      </Link>
    </Tag>
  );
}

/** An open plate's head: the view's h1 (focus lands on it), its printed name, tags, and more below. */
export function FocusHead({ label, title, tags, children }: { label: string; title: string; tags?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.focusHead} data-head="" data-fit="">
      <div className={styles.band}>
        <h1 className={styles.bandTitle} tabIndex={-1} data-stage-title="">
          <span className={`${styles.bandLabel} ${styles.heroLabel}`} aria-hidden="true">{label}</span>
          <span className={styles.bandKo}><BrandText text={title} /></span>
        </h1>
        {tags && <span className={styles.bandTags} aria-hidden="true">{tags}</span>}
      </div>
      {children}
    </header>
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
