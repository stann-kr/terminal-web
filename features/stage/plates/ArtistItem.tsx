'use client';
import Link from '@/features/ui/RouteLink';
import { ArtistChronology } from '@/features/artists/ArtistChronology';
import { artistHref, type ArtistProfile } from '@/features/artists/model';
import { SignalText } from '@/features/display/Display';
import { accessAvailability, bilingual, eventHref, paragraphs, sessionShort } from '@/features/events/model';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { Arrow, BrandText, ui, type Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import type { TerminalEvent } from '@/lib/events/types';
import { getSlotTimes } from '@/lib/events/lifecycle';
import { FitTitle } from '../FitTitle';
import type { StageState } from '../state';
import { TextPages } from '../TextPages';
import type { ItemShape } from './EventItem';
import styles from './plates.module.css';

const upcoming = (profile: ArtistProfile) => profile.appearances.some(row => row.event.status !== 'ARCHIVED');
const featured = (profile: ArtistProfile) => profile.key === 'stann-lumo';

/** A session's number as printed in its name (`TERMINAL [03]` → `03`), else its code. */
const sessionNumber = (event: TerminalEvent) => /\[(\d+)\]/.exec(event.session)?.[1] ?? event.id;

/** Where a coming set sits (`TRM-03 · DOCK 2 · 00:00`), else the latest session played (`최근 TRM-02`). */
function cardNote(profile: ArtistProfile) {
  const coming = profile.appearances.find(row => row.event.status !== 'ARCHIVED');
  if (coming) {
    const start = getSlotTimes(coming.event, coming.artist.time) ? coming.artist.time.split(/\s*[-–]\s*/)[0] : null;
    return [coming.event.id, `DOCK ${coming.artist.dock || 'TBA'}`, ...(start ? [start] : [])].join(' · ');
  }
  const latest = profile.appearances.at(-1);
  return latest ? `최근 ${latest.event.id}` : '';
}

/** STANN LUMO is the featured plate, an artist with a coming set is marked, the rest are records. */
export function artistSurface(profile: ArtistProfile, open = false): Surface {
  if (featured(profile)) return 'feature';
  if (upcoming(profile)) return 'mark';
  return open ? 'paper' : 'inset';
}

/** An artist's sub-plate inside the roster plate: a roster cell, a file card in the grid, or an index line. */
export function ArtistItem({ profile, shape, current = false, sessions = [] }: { profile: ArtistProfile; shape: ItemShape; current?: boolean; /** Every session, oldest first: a card marks the ones the artist played. */ sessions?: readonly TerminalEvent[] }) {
  const carrier = `artist:${profile.key}`;
  const records = String(profile.appearances.length).padStart(2, '0');
  if (shape === 'cell') {
    return (
      <Link href={artistHref(profile.key)} className={`${styles.card} ${styles.artistCell}`} data-carrier={carrier} scroll={false}>
        <FitTitle as="span" text={profile.name} maxLines={1} minPx={12} className={styles.cellName} arrow="in">{profile.name}</FitTitle>
        <span className={styles.cellMeta} aria-hidden="true">{profile.origin} · {records} REC</span>
      </Link>
    );
  }
  if (shape === 'index') {
    return (
      <Link href={artistHref(profile.key)} className={`${styles.card} ${styles.indexLine}`} data-carrier={carrier} aria-current={current ? 'page' : undefined} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{profile.origin || '—'}</span>
        <FitTitle as="span" text={profile.name} maxLines={1} minPx={12} className={styles.cellName} arrow="in">{profile.name}</FitTitle>
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
          <span>{profile.origin || '—'}</span>
          <SignalText active={upcoming(profile)}>{live ? 'LIVE 출연' : next ? '예정 출연' : '출연 기록'}</SignalText>
        </span>
        <FitTitle as="h2" text={profile.name} maxLines={2} minPx={18} className={styles.cardName} arrow="in" />
        <span className={styles.cardFoot}>
          {sessions.length > 0 && (
            <span className={styles.cardSessions}>
              <span className={styles.srOnly}>출연 회차 </span>
              {sessions.map(event => {
                const played = profile.appearances.some(row => row.event.id === event.id);
                return (
                  <span key={event.id} data-on={played || undefined} aria-hidden={!played || undefined}>
                    [{sessionNumber(event)}]
                  </span>
                );
              })}
            </span>
          )}
          <span>{cardNote(profile)}</span>
        </span>
      </Link>
    );
  }
  return null;
}

/** The artist file: identity, appearances, biography, then the shared lineup in reading order. */
export function ArtistFile({ profile, state, data }: { profile: ArtistProfile; state: StageState; data: StageData }) {
  const { language } = useLanguage();
  const current = state.view === 'artist' && state.artistKey === profile.key;
  const biography = profile.appearances.find(row => paragraphs(row.artist.description, language).length);
  const sessions = [...(data.events ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  // The artist's coming set, with the guest request while it is open.
  const coming = profile.appearances.find(row => row.event.status !== 'ARCHIVED');
  const canRequest = !!coming && !!data.events && accessAvailability(coming.event, data.events, data.now).canRequest;
  return (
    <article className={styles.artistFile} aria-labelledby={`artist-${profile.key}`}>
      <div className={styles.fileMain} data-fit="">
        <p className={`${ui.band} ${styles.fileOrigin}`} aria-hidden="true">
          <span>ORIGIN / {profile.origin || '—'}</span>
          <span>출연 {profile.appearances.length}</span>
        </p>
        <FitTitle as="h1" id={`artist-${profile.key}`} heading={current} text={profile.name} maxLines={3} minPx={28} className={styles.fileName} />
        <p className={styles.fileSessions}>
          <span className={styles.srOnly}>출연 회차 </span>
          {sessions.map(event => {
            const played = profile.appearances.some(row => row.event.id === event.id);
            return (
              <span key={event.id} data-on={played || undefined} aria-hidden={!played || undefined}>
                [{sessionNumber(event)}]
              </span>
            );
          })}
        </p>
        {coming && (
          <section className={styles.fileNext} aria-label="다음 무대">
            <p className={ui.band} lang="en"><span>Next set</span><span>{coming.event.id}</span></p>
            <p className={styles.fileNextName}><BrandText text={sessionShort(coming.event.session)} /></p>
            <p className={styles.fileNextSlot}>
              <span>DOCK {coming.artist.dock || 'TBA'}</span>
              <b>{coming.artist.time || 'TBA'}</b>
              <span>{coming.event.date} · {coming.event.venue}</span>
            </p>
          </section>
        )}
        {coming && (
          <span className={styles.fileKeys}>
            {canRequest && (
              <Link href={`${eventHref(coming.event.id)}/request`} className={`${styles.card} ${styles.nextKey}`} data-surface="paper" data-carrier={`event:${coming.event.id}`} scroll={false}>
                {coming.event.id} 게스트 신청<Arrow />
              </Link>
            )}
            <Link href={eventHref(coming.event.id)} className={`${styles.card} ${styles.nextKey}`} data-key="file" data-carrier={`event:${coming.event.id}`} scroll={false}>
              세션 파일 열기<Arrow />
            </Link>
          </span>
        )}
      </div>
      <ArtistChronology profile={profile} events={data.events ?? []} recordsClassName={styles.fileRecords} sharedClassName={styles.fileShared}>
        <section className={styles.fileBio} data-surface="inset" aria-label="소개">
          <p className={styles.columnHead}><b aria-hidden="true">Biography</b><span>소개</span>{bilingual(biography?.artist.description) && <LanguageToggle />}</p>
          <TextPages paragraphs={paragraphs(biography?.artist.description, language)} language={language} label="아티스트 소개" empty="소개는 공개되는 대로 이곳에 표시됩니다." more />
        </section>
      </ArtistChronology>
    </article>
  );
}
