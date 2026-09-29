import Link from 'next/link';
import { SignalText } from '@/features/display/Display';
import { artistHref, type ArtistProfile } from './model';
import styles from './artists.module.css';

/** A printed four-digit serial derived from the profile key; ornament, not an identifier. */
function serial(key: string) {
  const sum = Array.from(key).reduce((total, char, index) => (total * 31 + char.charCodeAt(0) * (index + 1)) % 9973, 7);
  return String(sum % 10000).padStart(4, '0');
}

/** A register tile: header row, the name, and a code cell — like a module tag on a rack. */
export function ArtistCard({ profile }: { profile: ArtistProfile }) {
  const upcoming = profile.appearances.some((row) => row.event.status !== 'ARCHIVED');
  const featured = profile.key === 'stann-lumo';
  return (
    <Link
      data-upcoming={upcoming}
      data-featured={featured || undefined}
      data-surface={featured ? 'signal' : upcoming ? 'sand' : undefined}
      className={styles.cell}
      href={artistHref(profile.key)}
    >
      <span className={styles.cellHeader}>
        <span>ARTIST / {profile.origin}</span>
        <SignalText active={upcoming}>
          {profile.appearances.some((row) => row.event.status === 'LIVE')
            ? 'LIVE 출연'
            : profile.appearances.some((row) => row.event.status === 'UPCOMING')
              ? '예정 출연'
              : '출연 기록'}
        </SignalText>
      </span>
      <h2>{profile.name}</h2>
      <span className={styles.cellFoot} aria-hidden="true">
        <span className={styles.tag}>{profile.origin}-{String(profile.appearances.length).padStart(2, '0')} REC</span>
        <span className={styles.serialNumber}>{serial(profile.key)}</span>
      </span>
    </Link>
  );
}

/**
 * An unassigned slot that completes the last row. `fills` lists the column counts (3, 4, 6) at
 * which this slot is needed, so a narrower grid never grows an extra empty row.
 */
export function EmptyCell({ fills }: { fills: string }) {
  return (
    <span className={styles.emptyCell} aria-hidden="true" data-fills={fills}>
      <b>----</b>
      <span>0000</span>
      <small>----</small>
    </span>
  );
}
