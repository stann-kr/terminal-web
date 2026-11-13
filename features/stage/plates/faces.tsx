import Link from '@/features/ui/RouteLink';
import type { CSSProperties, ReactNode } from 'react';
import { Arrow, BrandText, type Surface } from '@/features/ui/Ui';
import { FitTitle } from '../FitTitle';
import styles from './plates.module.css';

/**
 * The faces a plate wears. One pointing rule everywhere: the plate you are looking at (the hero)
 * is read and its items (rows, cards, forms) are pressed; every other plate is one link as a whole,
 * and every item is its own card. Whatever is pressed lights up as a whole, in the plate's
 * highlight colour. Every link is a real link (middle click, new tab and copied address work).
 */

/** A whole face that is a single link: chips, the back card, summary plates with nothing inside to press. */
/** `external`: another site, a plain link in a new tab (middle click and copied address still work). */
export function CardLink({ href, className = '', label, carrier, surface, external = false, children }: { href: string; className?: string; label?: string; carrier?: string; surface?: Surface; external?: boolean; children: ReactNode }) {
  if (external)
    return (
      <a href={href} className={`${styles.card} ${className}`} aria-label={label} data-surface={surface} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  return (
    <Link href={href} className={`${styles.card} ${className}`} aria-label={label} data-carrier={carrier} data-surface={surface} scroll={false}>
      {children}
    </Link>
  );
}

/**
 * A chip: the plate's name large over one line with its Korean name and meta. The line is set as
 * large as the chip's width allows (pretext), never cut short.
 */
export function ChipFace({ href, name, title, meta, carrier, label, external = false }: { href: string | null; name: string; title: string; meta?: string; carrier?: string; label?: string; external?: boolean }) {
  const line = meta ? `${title} · ${meta}` : title;
  const body = (
    <>
      {/* The name's length bounds its size, so a long name (INSTAGRAM) still fits a narrow chip. */}
      {/* When the chip is too narrow for its line, the name carries the link's colour and arrow. */}
      <span className={styles.chipName} aria-hidden="true" style={{ '--len': name.length } as CSSProperties}>
        {name}
        {href && <Arrow external={external} />}
      </span>
      <FitTitle as="span" text={line} maxLines={1} minPx={12} className={styles.chipLine} arrow={href ? (external ? 'out' : 'in') : undefined}>
        <span className={styles.linkName}>{title}</span>
        {meta && <span aria-hidden="true"> · {meta}</span>}
      </FitTitle>
    </>
  );
  if (!href) return <div className={`${styles.card} ${styles.chip}`}>{body}</div>;
  return (
    <CardLink href={href} className={styles.chip} carrier={carrier} label={label} external={external}>
      {body}
    </CardLink>
  );
}

/**
 * The printed name of a plate over its rule: English station name, Korean title, tags. `link`: the
 * band names a link, so its title is printed in the link colour with an arrow after it.
 */
function BandBody({ label, title, tags, link = false }: { label: string; title: string; tags?: ReactNode; link?: boolean }) {
  return (
    <>
      <span className={styles.bandTitle}>
        <span className={styles.bandLabel} aria-hidden="true">{label}</span>
        <BandName title={title} link={link} />
      </span>
      {tags && <span className={styles.bandTags} aria-hidden="true">{tags}</span>}
    </>
  );
}

/** A band's Korean title; inside a link it is the link's name, in the link colour with its arrow. */
export function BandName({ title, link = false }: { title: string; link?: boolean }) {
  return (
    <span className={styles.bandKo} data-link={link || undefined}>
      <BrandText text={title} />
      {link && <Arrow />}
    </span>
  );
}

/**
 * A summary plate that is one link as a whole. Its band marks where the plate's carriers may
 * start (`data-head`); the carriers float above it as cards of their own.
 */
export function PlateCard({ href, label, title, tags, children }: { href: string; label: string; title: string; tags?: ReactNode; children?: ReactNode }) {
  return (
    <CardLink href={href} className={styles.plateCard}>
      <span className={styles.band} data-head="">
        <BandBody label={label} title={title} tags={tags} link />
      </span>
      {children}
    </CardLink>
  );
}

/** An open plate's head: the view's h1 (focus lands on it), its printed name, tags, and more below. */
export function FocusHead({ label, title, tags, children }: { label: string; title: string; tags?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.focusHead} data-head="" data-fit="">
      <div className={styles.band}>
        <h1 className={styles.bandTitle} tabIndex={-1} data-stage-title="">
          <span className={`${styles.bandLabel} ${styles.heroLabel}`} aria-hidden="true">{label}</span>
          <BandName title={title} />
        </h1>
        {tags && <span className={styles.bandTags} aria-hidden="true">{tags}</span>}
      </div>
      {children}
    </header>
  );
}

/**
 * A plate's data state at summary and chip sizes: one flush line (loading, empty, or a failed read
 * with its retry key), so a short plate is never handed a notice taller than itself. It is a polite
 * status: the open plate or file states the failure as the alert, so it is announced once.
 */
export function PlateStatus({ state, text, retry }: { state: 'loading' | 'empty' | 'error'; text: string; retry?: () => void }) {
  return (
    <div className={styles.status} data-state={state} role="status">
      <span>{text}</span>
      {state === 'error' && retry && (
        <button type="button" onClick={retry}>
          다시 불러오기
        </button>
      )}
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
