'use client';
import Link from 'next/link';
import { ArtistChronology } from '@/features/artists/ArtistChronology';
import { artistHref, type ArtistProfile } from '@/features/artists/model';
import { SignalText } from '@/features/display/Display';
import { bilingual, paragraphs } from '@/features/events/model';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { ui, type Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import { FitTitle } from '../FitTitle';
import type { StageState } from '../state';
import { TextPages } from '../TextPages';
import type { ItemShape } from './EventItem';
import styles from './plates.module.css';

const upcoming = (profile: ArtistProfile) => profile.appearances.some(row => row.event.status !== 'ARCHIVED');
const featured = (profile: ArtistProfile) => profile.key === 'stann-lumo';

/** A printed four-digit serial derived from the profile key; ornament, not an identifier. */
function serial(key: string) {
  const sum = Array.from(key).reduce((total, char, index) => (total * 31 + char.charCodeAt(0) * (index + 1)) % 9973, 7);
  return String(sum % 10000).padStart(4, '0');
}

/** STANN LUMO is the featured plate, an artist with a coming set is marked, the rest are records. */
export function artistSurface(profile: ArtistProfile, open = false): Surface {
  if (featured(profile)) return 'feature';
  if (upcoming(profile)) return 'mark';
  return open ? 'paper' : 'inset';
}

/** An artist's sub-plate inside the roster plate: a roster cell, a file card in the grid, or an index line. */
export function ArtistItem({ profile, shape, current = false }: { profile: ArtistProfile; shape: ItemShape; current?: boolean }) {
  const carrier = `artist:${profile.key}`;
  const records = String(profile.appearances.length).padStart(2, '0');
  if (shape === 'cell') {
    return (
      <Link href={artistHref(profile.key)} className={`${styles.card} ${styles.artistCell}`} data-carrier={carrier} scroll={false}>
        <FitTitle as="span" text={profile.name} maxLines={1} minPx={12} className={styles.cellName}>{profile.name}</FitTitle>
        <span className={styles.cellMeta} aria-hidden="true">{profile.origin} · {records} REC</span>
      </Link>
    );
  }
  if (shape === 'index') {
    return (
      <Link href={artistHref(profile.key)} className={`${styles.card} ${styles.indexLine}`} data-carrier={carrier} aria-current={current ? 'page' : undefined} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{profile.origin || '—'}</span>
        <FitTitle as="span" text={profile.name} maxLines={1} minPx={12} className={styles.cellName}>{profile.name}</FitTitle>
      </Link>
    );
  }
  if (shape === 'row') {
    const live = profile.appearances.some(row => row.event.status === 'LIVE');
    const next = profile.appearances.some(row => row.event.status === 'UPCOMING');
    return (
      <Link
        href={artistHref(profile.key)}
        className={`${styles.card} ${styles.artistCard}`}
        data-featured={featured(profile) || undefined}
        data-upcoming={upcoming(profile)}
        data-carrier={carrier}
        scroll={false}
      >
        <span className={styles.cardHead}>
          <span>ARTIST / {profile.origin}</span>
          <SignalText active={upcoming(profile)}>{live ? 'LIVE 출연' : next ? '예정 출연' : '출연 기록'}</SignalText>
        </span>
        <FitTitle as="h2" text={profile.name} maxLines={2} minPx={18} className={styles.cardName} />
        <span className={styles.cardFoot} aria-hidden="true">
          <span>{profile.origin}-{records} REC</span>
          <span>{serial(profile.key)}</span>
        </span>
      </Link>
    );
  }
  return null;
}

/** The artist file a cell grows into: identity, appearances and shared lineups, then the biography. */
export function ArtistFile({ profile, state, data }: { profile: ArtistProfile; state: StageState; data: StageData }) {
  const { language } = useLanguage();
  const current = state.view === 'artist' && state.artistKey === profile.key;
  const biography = profile.appearances.find(row => paragraphs(row.artist.description, language).length);
  return (
    <article className={styles.artistFile} aria-labelledby={`artist-${profile.key}`}>
      <div className={styles.fileMain} data-fit="">
        <p className={`${ui.band} ${styles.fileOrigin}`} aria-hidden="true">
          <span>ORIGIN / {profile.origin || '—'}</span>
          <span>{profile.origin || 'XX'}-{serial(profile.key)}</span>
        </p>
        <FitTitle as="h1" id={`artist-${profile.key}`} heading={current} text={profile.name} maxLines={3} minPx={28} className={styles.fileName} />
      </div>
      <div className={styles.fileRecords} data-fit="">
        {data.events && <ArtistChronology profile={profile} events={data.events} />}
      </div>
      <section className={styles.fileBio} data-surface="inset" aria-label="소개">
        <p className={styles.columnHead}><b aria-hidden="true">Biography</b><span>소개</span>{bilingual(biography?.artist.description) && <LanguageToggle />}</p>
        <TextPages paragraphs={paragraphs(biography?.artist.description, language)} language={language} label="아티스트 소개" empty="소개는 공개되는 대로 이곳에 표시됩니다." />
      </section>
    </article>
  );
}
