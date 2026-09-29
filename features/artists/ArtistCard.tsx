import Link from 'next/link';
import { SignalText } from '@/features/display/Display';
import { artistHref, type ArtistProfile } from './model';
import { ArtistGlyph } from './ArtistGlyph';
import { Blocks } from '@/features/display/Blocks';
import styles from './artists.module.css';

/** A printed four-digit serial derived from the profile key; ornament, not an identifier. */
function serial(key: string) {
  const sum = Array.from(key).reduce((total, char, index) => (total * 31 + char.charCodeAt(0) * (index + 1)) % 9973, 7);
  return String(sum % 10000).padStart(4, '0');
}

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
      <ArtistGlyph name={profile.name} />
      <Blocks
        cols={10}
        motion="scan"
        step={120}
        offset={Array.from(profile.key).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 10 * 120}
        className={styles.cellScan}
      />
      <h2>{profile.name}</h2>
      <span className={styles.serial} aria-hidden="true">
        <b>{profile.origin}-{serial(profile.key)}</b>
        <span>{String(profile.appearances.length).padStart(2, '0')} REC</span>
      </span>
    </Link>
  );
}

/** An unassigned roster slot, printed like an empty register tile. */
export function EmptyCell() {
  return (
    <span className={styles.emptyCell} aria-hidden="true">
      <b>----</b>
      <span>0000</span>
      <small>OPEN SLOT</small>
    </span>
  );
}
