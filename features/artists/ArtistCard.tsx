import Link from 'next/link';
import { SignalText } from '@/features/display/Display';
import { artistHref, type ArtistProfile } from './model';
import { ArtistGlyph } from './ArtistGlyph';
import { Blocks } from '@/features/display/Blocks';
import styles from './artists.module.css';

export function ArtistCard({ profile }: { profile: ArtistProfile }) {
  return (
    <Link
      data-upcoming={profile.appearances.some(
        (row) => row.event.status !== 'ARCHIVED',
      )}
      data-featured={profile.key === 'stann-lumo' || undefined}
      className={styles.cell}
      href={artistHref(profile.key)}
    >
      <span className={styles.cellHeader}>
        <span>ARTIST / {profile.origin}</span>
        <SignalText
          active={profile.appearances.some(
            (row) => row.event.status !== 'ARCHIVED',
          )}
        >
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
        tone={profile.appearances.some((row) => row.event.status !== 'ARCHIVED') ? 'amber' : 'ice'}
        className={styles.cellScan}
      />
      <h2>{profile.name}</h2>
    </Link>
  );
}
