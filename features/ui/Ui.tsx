import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** Sets every occurrence of the word TERMINAL in the brand face; other text is untouched. */
export function BrandText({ text }: { text: string }) {
  if (!text.includes('TERMINAL')) return <>{text}</>;
  return (
    <>
      {text.split(/(TERMINAL)/).map((part, index) =>
        part === 'TERMINAL' ? <span key={index} className={styles.brandWord}>{part}</span> : part,
      )}
    </>
  );
}
function brand(children: ReactNode) {
  return typeof children === 'string' ? <BrandText text={children} /> : children;
}

export function PageHeading({ title }: { title: string }) {
  return <h1 className={styles.srOnly}>{title}</h1>;
}
/** A plate's role; its colours come from the active palette (app/palettes.css). */
export type Surface = 'panel' | 'inset' | 'paper' | 'feature' | 'mark' | 'alert' | 'calm' | 'fresh';

/**
 * A console plate: a big printed English station name over a heavy rule, the Korean title beside it,
 * optional tag chips on the right. `heading={false}` keeps the face without adding to the outline.
 */
export function Panel({
  title,
  label,
  code,
  children,
  surface = 'panel',
  heading = true,
  className = '',
}: {
  title: string;
  /** Short English station label printed large; decorative. */
  label?: string;
  code?: string;
  children: ReactNode;
  surface?: Surface;
  heading?: boolean;
  className?: string;
}) {
  const Title = heading ? 'h2' : 'p';
  return (
    <section className={`${styles.panel} ${className}`} data-surface={surface}>
      <header className={styles.panelHead}>
        <Title className={styles.panelTitle} data-labelled={label ? true : undefined}>
          {label && <span className={styles.panelLabel} aria-hidden="true">{label}</span>}
          <span className={styles.panelKo}><BrandText text={title} /></span>
        </Title>
        {code && <span className={styles.chip} aria-hidden="true">{code}</span>}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

/** A small printed tag; `solid` fills it with ink. */
export function Chip({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  return <span className={styles.chip} data-solid={solid || undefined}>{children}</span>;
}

/** A quiet reserve that takes the remaining height of a panel; decorative, labelled like a bay. */
export function Bay({ label }: { label: string }) {
  return (
    <p className={styles.bay} aria-hidden="true" data-bay="">
      <span>{label}</span>
    </p>
  );
}
export function Action({
  href,
  children,
  primary = false,
  carrier,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  /** Marks a link that opens a detail (`event:ID`, `artist:KEY`), so the stage grows it from here. */
  carrier?: string;
}) {
  return (
    <Link
      className={`${styles.action} ${primary ? styles.primary : ''}`}
      href={href}
      data-carrier={carrier}
      scroll={carrier ? false : undefined}
    >
      {brand(children)}
    </Link>
  );
}
/** A panel's keys as full-width bars across the plate: the one primary key solid, the rest tinted. */
export function ActionDeck({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.deck} ${className}`}>{children}</div>;
}
export function Facts({
  rows,
}: {
  rows: readonly (readonly [string, ReactNode])[];
}) {
  return (
    <dl className={styles.facts}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === '' || value == null ? '미정' : value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function StateNotice({
  title,
  children,
  error = false,
  retry,
}: {
  title: string;
  children?: ReactNode;
  error?: boolean;
  retry?: () => void;
}) {
  return (
    <div
      className={styles.notice}
      data-surface={error ? 'alert' : undefined}
      role={error ? 'alert' : 'status'}
    >
      <div className={styles.noticeText}>
        <p className={styles.eyebrow} aria-hidden="true">{error ? 'ERROR' : 'NOTICE'}</p>
        <h2>{title}</h2>
        {children && <div className={styles.noticeBody}>{children}</div>}
      </div>
      {retry && (
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={retry}>
          다시 불러오기
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <p role="status" className={styles.loading}>
      기록을 불러오는 중<span aria-hidden="true" />
    </p>
  );
}
export { styles as ui };
