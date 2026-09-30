'use client';
import Link from 'next/link';
import { ArtistChronology } from '@/features/artists/ArtistChronology';
import { artistHref, type ArtistProfile } from '@/features/artists/model';
import { SignalText } from '@/features/display/Display';
import { eventHref, paragraphs } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import { BrandText, type Surface } from '@/features/ui/Ui';
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

/** STANN LUMO is the signal (orange), an artist with a coming set is gold, the rest are records. */
export function artistSurface(profile: ArtistProfile, shape: ItemShape): Surface {
  if (featured(profile)) return 'orange';
  if (upcoming(profile)) return 'gold';
  return shape === 'detail' ? 'cream' : 'deep';
}

/** An artist's one element on the stage: a roster cell, a file card in the grid, or the open file. */
export function ArtistItem({ profile, shape, state, data }: { profile: ArtistProfile; shape: ItemShape; state: StageState; data: StageData }) {
  const carrier = `artist:${profile.key}`;
  const records = String(profile.appearances.length).padStart(2, '0');
  if (shape === 'cell') {
    return (
      <Link href={artistHref(profile.key)} className={styles.artistCell} data-carrier={carrier} scroll={false}>
        <span className={styles.cellName}>{profile.name}</span>
        <span className={styles.cellMeta} aria-hidden="true">{profile.origin} · {records} REC</span>
      </Link>
    );
  }
  if (shape === 'row') {
    const live = profile.appearances.some(row => row.event.status === 'LIVE');
    const next = profile.appearances.some(row => row.event.status === 'UPCOMING');
    return (
      <Link
        href={artistHref(profile.key)}
        className={styles.artistCard}
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
  return <ArtistFile profile={profile} state={state} data={data} />;
}

/** The artist file a cell grows into: identity, appearances and shared lineups, then the biography. */
function ArtistFile({ profile, state, data }: { profile: ArtistProfile; state: StageState; data: StageData }) {
  const { language } = useLanguage();
  const current = state.view === 'artist' && state.artistKey === profile.key;
  const biography = profile.appearances.find(row => paragraphs(row.artist.description, language).length);
  return (
    <article className={styles.artistFile} aria-labelledby={`artist-${profile.key}`}>
      <div className={styles.fileMain} data-fit="">
        <p className={styles.fileOrigin} aria-hidden="true">ORIGIN / {profile.origin || '—'}</p>
        <FitTitle as="h1" id={`artist-${profile.key}`} heading={current} text={profile.name} maxLines={3} minPx={28} className={styles.fileName} />
        <p className={styles.fileCode} aria-hidden="true">{profile.origin || 'XX'}-{serial(profile.key)}</p>
      </div>
      <div className={styles.fileRecords} data-fit="">
        {data.events && <ArtistChronology profile={profile} events={data.events} />}
      </div>
      <section className={styles.fileBio} data-surface="navy" aria-label="소개">
        <p className={styles.columnHead}><b aria-hidden="true">Biography</b><span>소개</span><small aria-hidden="true">{language.toUpperCase()}</small></p>
        <TextPages paragraphs={paragraphs(biography?.artist.description, language)} language={language} label="아티스트 소개" empty="소개는 공개되는 대로 이곳에 표시됩니다." />
        {biography && (
          <p className={styles.fileSource}>
            출처:{' '}
            <Link href={eventHref(biography.event.id)} data-carrier={`event:${biography.event.id}`} scroll={false}>
              <BrandText text={biography.event.session} /> / {biography.event.date}
            </Link>
          </p>
        )}
      </section>
    </article>
  );
}
