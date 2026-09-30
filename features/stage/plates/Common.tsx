import Link from 'next/link';
import type { ReactNode } from 'react';
import { PLATE_META } from '../links';
import type { PlateId } from '../state';
import s from '../stage.module.css';

/** A folded plate in the rail: its station name and one reading; the whole cell is the link. */
export function RailKey({ plate, href, meta }: { plate: PlateId; href: string; meta: ReactNode }) {
  const { label, ko } = PLATE_META[plate];
  return (
    <Link href={href} className={s.railKey}>
      <span className={s.railLabel} aria-hidden="true">{label}</span>
      <span className={s.srOnly}>{ko}</span>
      <span className={s.railMeta} aria-hidden="true">{meta}</span>
    </Link>
  );
}

/**
 * A tile's title bar. The title link stretches over the whole tile, so the tile opens its plate;
 * records and cells inside the tile sit above it and keep their own links.
 */
export function TileHead({ plate, title, href, chip, label }: {
  plate: PlateId;
  title: string;
  href: string;
  chip?: ReactNode;
  label?: string;
}) {
  return (
    <header className={s.tileHead}>
      <h2 className={s.tileTitle}>
        <Link href={href} className={s.stretch}>
          <span className={s.tileLabel} aria-hidden="true">{label ?? PLATE_META[plate].label}</span>
          <span className={s.tileKo}>{title}</span>
        </Link>
      </h2>
      {chip != null && <span className={s.plateChip} aria-hidden="true">{chip}</span>}
    </header>
  );
}

/** The heading of an open plate; the stage moves focus here after a route change. */
export function FocusTitle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <h1 className={s.focusTitle} tabIndex={-1} data-stage-title="">
      <span className={s.focusLabel} aria-hidden="true">{label}</span>
      <span className={s.focusKo}>{children}</span>
    </h1>
  );
}

/** The folded parent above an open detail: one key back to the list. */
export function StripKey({ plate, href, name, meta, action }: {
  plate: PlateId;
  href: string;
  name: string;
  meta: ReactNode;
  action: string;
}) {
  return (
    <Link href={href} className={s.stripKey} aria-label={name}>
      <span className={s.stripLabel} aria-hidden="true">{PLATE_META[plate].label === 'EVENTS' ? 'SESSION DIRECTORY' : 'ARTIST ROSTER'}</span>
      <span className={s.stripMeta} aria-hidden="true">{meta}</span>
      <span className={s.stripAction} aria-hidden="true">{action}</span>
    </Link>
  );
}

export const pad = (value: number, size = 3) => String(value).padStart(size, '0');
