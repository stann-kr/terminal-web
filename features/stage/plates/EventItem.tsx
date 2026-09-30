'use client';
/* eslint-disable @next/next/no-img-element -- Posters retain their source aspect ratio without invented dimensions. */
import Link from 'next/link';
import { useState } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { AccessRequest } from '@/features/access/Access';
import { EventActions, EventFacts, Lineup } from '@/features/events/EventRecord';
import { eventHref, paragraphs, publicArtists, statusLabel } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import { BrandText, Chip, StateNotice, type Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import { FitTitle } from '../FitTitle';
import type { ItemMode } from '../layout';
import type { StageState } from '../state';
import { TextPages } from '../TextPages';
import styles from './plates.module.css';

/** The shapes a session's sub-plate takes; `folded` keeps whichever shape it last had. */
export type ItemShape = Exclude<ItemMode, 'folded'>;

/** A session reads in its state colour as an open file; as a cell, row or line it is a dark record. */
export function sessionSurface(event: TerminalEvent): Surface {
  return event.status === 'ARCHIVED' ? 'cream' : event.status === 'LIVE' ? 'red' : 'orange';
}

/** A session's sub-plate inside the directory plate: a summary cell, a directory row, or an index line. */
export function EventItem({ event, shape, current = false }: { event: TerminalEvent; shape: ItemShape; current?: boolean }) {
  const carrier = `event:${event.id}`;
  if (shape === 'cell') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventCell}`} data-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={event.session} maxLines={1} minPx={12} className={styles.cellName}><BrandText text={event.session} /></FitTitle>
        <span className={styles.cellState}>{statusLabel(event.status)}</span>
      </Link>
    );
  }
  if (shape === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.indexLine}`} data-carrier={carrier} aria-current={current ? 'page' : undefined} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={event.session} maxLines={1} minPx={12} className={styles.cellName}><BrandText text={event.session} /></FitTitle>
      </Link>
    );
  }
  if (shape === 'row') {
    const artists = publicArtists(event).map(artist => artist.name).join(' · ');
    const line = [event.subtitle, artists].filter(Boolean).join(' · ');
    const when = `${event.date} ${event.time.replace(' KST', '')} KST`;
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventRow}`} data-event-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.rowId}>{event.id}</span>
        <span className={styles.rowMain}>
          <FitTitle as="h2" text={event.session} maxLines={1} minPx={16} className={styles.rowName}>
            <BrandText text={event.session} />
          </FitTitle>
          {line && (
            <FitTitle as="span" text={line} maxLines={1} minPx={12} className={styles.rowLine}>
              {event.subtitle}
              {event.subtitle && artists && ' · '}
              {artists && <span className={styles.rowArtists}><span className={styles.srOnly}>출연 </span>{artists}</span>}
            </FitTitle>
          )}
          {/* A narrow row prints its code, time and venue here, on one fitted line. */}
          <FitTitle as="span" text={`${event.id} · ${when} · ${event.venue}`} maxLines={1} minPx={12} className={styles.rowNarrowMeta}>
            {event.id} · {when} · {event.venue}
          </FitTitle>
        </span>
        <span className={styles.rowWhen}>
          {event.date}
          <small>{event.time.replace(' KST', '')} KST</small>
        </span>
        <FitTitle as="span" text={event.venue} maxLines={1} minPx={12} className={styles.rowVenue}>{event.venue}</FitTitle>
        <span className={styles.rowState}>{statusLabel(event.status)}</span>
      </Link>
    );
  }
  return null;
}

/**
 * A poster in a slot the layout sizes, never the image: until the image has decoded the slot shows
 * its ring pattern, then the poster fades in, contained. A late image never moves anything.
 */
function Poster({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <a className={styles.poster} href={src} target="_blank" rel="noopener noreferrer" data-loaded={loaded || undefined}>
      <img
        ref={image => {
          if (image?.complete && image.naturalWidth) setLoaded(true);
        }}
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </a>
  );
}

/**
 * The session file a row grows into: overview, running order, and the briefing over the access
 * panel. On `/request` the access panel opens into the guest form and the briefing folds away.
 */
export function SessionFile({ event, state, data }: { event: TerminalEvent; state: StageState; data: StageData }) {
  const { language } = useLanguage();
  const current = state.view === 'session' && state.eventId === event.id;
  const request = current && state.view === 'session' && state.request;
  const briefing = paragraphs(event.description, language);
  const invitation = paragraphs(event.invitationLines, language);
  const hasOrder = publicArtists(event).length > 0;
  return (
    <article className={styles.session} data-request={request || undefined} aria-labelledby={`session-${event.id}`}>
      <div className={styles.sessionMain} data-fit="">
        <p className={styles.sessionState} aria-hidden="true">
          <span data-event-state={event.status}>{statusLabel(event.status)}</span>
          <Chip>{event.id}</Chip>
        </p>
        <FitTitle as="h1" id={`session-${event.id}`} heading={current} text={event.session} maxLines={3} minPx={28} className={styles.sessionTitle}>
          <BrandText text={event.session} />
        </FitTitle>
        {event.subtitle && <p className={styles.sessionSubtitle}>{event.subtitle}</p>}
        <EventFacts event={event} modular />
        {event.posterUrl && <Poster src={event.posterUrl} alt={`${event.session} 행사 포스터 — 새 탭에서 확대`} />}
      </div>
      <section className={styles.sessionOrder} data-surface="navy" aria-label="공연표">
        <p className={styles.columnHead}><b aria-hidden="true">Running order</b><span>공연표</span></p>
        <div className={styles.fitColumn} data-fit="">
          {hasOrder && data.events ? (
            <Lineup event={event} events={data.events} stages />
          ) : (
            <StateNotice title="공연표 공개 전입니다">출연진과 시간표는 공개되는 대로 이곳에 표시됩니다.</StateNotice>
          )}
        </div>
      </section>
      <div className={styles.sessionSide}>
        {!request && (
          <section className={styles.sessionBriefing} data-surface="deep" aria-label="행사 소개">
            <p className={styles.columnHead}><b aria-hidden="true">Briefing</b><span>행사 소개</span><small aria-hidden="true">{language.toUpperCase()}</small></p>
            <TextPages
              paragraphs={invitation.length ? [...briefing, '초대 안내', ...invitation] : briefing}
              language={language}
              label="행사 소개"
              empty="행사 소개는 공개되는 대로 이곳에 표시됩니다."
            />
          </section>
        )}
        <section className={styles.sessionAccess} data-surface="cream" aria-label="참여 안내" data-origin="">
          {request ? (
            <>
              <p className={styles.columnHead}>
                <b aria-hidden="true">Access</b>
                <span>게스트 신청</span>
                <Link href={eventHref(event.id)} className={styles.closeKey} scroll={false}>신청 닫기</Link>
              </p>
              <div className={styles.fitColumn} data-fit="">
                <AccessRequest eventId={event.id} />
              </div>
            </>
          ) : (
            <>
              <p className={styles.columnHead}><b aria-hidden="true">Access</b><span>참여 안내</span></p>
              <div className={styles.fitColumn} data-fit="">
                {data.events && <EventActions event={event} events={data.events} now={data.now} />}
              </div>
            </>
          )}
        </section>
      </div>
    </article>
  );
}
