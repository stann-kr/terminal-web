'use client';
/* eslint-disable @next/next/no-img-element -- Posters retain their source aspect ratio without invented dimensions. */
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { AccessRequest } from '@/features/access/Access';
import { EventActions, EventFacts, Lineup } from '@/features/events/EventRecord';
import { bilingual, eventHref, eventSubtitle, isRuleLine, paragraphs, publicArtists, sessionShort, statusLabel } from '@/features/events/model';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { Action, ActionDeck, BrandText, StateNotice, ui, type Surface } from '@/features/ui/Ui';
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
  return event.status === 'ARCHIVED' ? 'paper' : event.status === 'LIVE' ? 'alert' : 'feature';
}

/** A session's sub-plate inside the directory plate: a summary cell, a directory row, or an index line. */
export function EventItem({ event, shape, current = false }: { event: TerminalEvent; shape: ItemShape; current?: boolean }) {
  const carrier = `event:${event.id}`;
  if (shape === 'cell') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventCell}`} data-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={sessionShort(event.session)} maxLines={1} minPx={12} className={styles.cellName}><BrandText text={sessionShort(event.session)} /></FitTitle>
        <span className={styles.cellState}>{statusLabel(event.status)}</span>
      </Link>
    );
  }
  if (shape === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.indexLine}`} data-carrier={carrier} aria-current={current ? 'page' : undefined} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={sessionShort(event.session)} maxLines={1} minPx={12} className={styles.cellName}><BrandText text={sessionShort(event.session)} /></FitTitle>
      </Link>
    );
  }
  if (shape === 'row') {
    const artists = publicArtists(event).map(artist => artist.name).join(' · ');
    const subtitle = eventSubtitle(event);
    const when = `${event.date} ${event.time.replace(' KST', '')} KST`;
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventRow}`} data-event-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.rowId}>{event.id}</span>
        <span className={styles.rowMain}>
          <FitTitle as="h2" text={sessionShort(event.session)} maxLines={1} minPx={16} className={styles.rowName}>
            <BrandText text={sessionShort(event.session)} />
          </FitTitle>
          {subtitle && (
            <FitTitle as="span" text={subtitle} maxLines={1} minPx={14} className={styles.rowSubtitle}>
              {subtitle}
            </FitTitle>
          )}
          {artists && (
            <FitTitle as="span" text={artists} maxLines={1} minPx={12} className={styles.rowLine}>
              <span className={styles.rowArtists}><span className={styles.srOnly}>출연 </span>{artists}</span>
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
 * A poster fades into its reserved slot. A failed image explains the empty slot and can be retried.
 */
function Poster({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const retry = () => {
    setStatus('loading');
    setAttempt(previous => previous + 1);
    // The retry button goes away; keep keyboard focus at the poster instead of losing it to body.
    root.current?.focus({ preventScroll: true });
  };
  return (
    <div ref={root} className={styles.poster} role="group" aria-label="이벤트 포스터" tabIndex={-1} aria-busy={status === 'loading'} data-loaded={status === 'loaded' || undefined}>
      {status === 'error' ? (
        <StateNotice title="포스터를 불러오지 못했습니다" className={styles.posterError}>
          <p>연결을 확인한 뒤 다시 시도하거나 원본을 열어 주세요.</p>
          <ActionDeck>
            <button type="button" className={ui.button} onClick={retry}>포스터 다시 불러오기</button>
            <Action href={src} external>원본 열기<span className={ui.srOnly}> (새 탭)</span></Action>
          </ActionDeck>
        </StateNotice>
      ) : (
        <a className={styles.posterLink} href={src} target="_blank" rel="noopener noreferrer">
          <img
            key={attempt}
            ref={image => {
              if (image?.complete) setStatus(image.naturalWidth ? 'loaded' : 'error');
            }}
            src={src}
            alt={alt}
            decoding="async"
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        </a>
      )}
    </div>
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
  // The invitation's text-art frame lines are dropped: drawn in characters, they break with the width.
  const invitation = paragraphs(event.invitationLines, language).filter(line => !isRuleLine(line));
  const hasOrder = publicArtists(event).length > 0;
  return (
    <article className={styles.session} data-request={request || undefined} aria-labelledby={`session-${event.id}`}>
      <div className={styles.sessionMain} data-fit="">
        <p className={`${ui.band} ${styles.sessionState}`} aria-hidden="true">
          <span data-event-state={event.status}>{statusLabel(event.status)}</span>
          <span>{event.id}</span>
        </p>
        <FitTitle as="h1" id={`session-${event.id}`} heading={current} text={sessionShort(event.session)} maxLines={3} minPx={28} className={styles.sessionTitle}>
          <BrandText text={sessionShort(event.session)} />
        </FitTitle>
        {eventSubtitle(event) && <p className={styles.sessionSubtitle}>{eventSubtitle(event)}</p>}
        <EventFacts event={event} modular />
        {event.posterUrl && <Poster key={event.posterUrl} src={event.posterUrl} alt={`${event.session} 이벤트 포스터 — 새 탭에서 확대`} />}
      </div>
      <section className={styles.sessionOrder} data-surface="panel" aria-label="공연표">
        <p className={styles.columnHead}><b aria-hidden="true">Running order</b><span>공연표</span></p>
        <div className={styles.fitColumn} data-fit="">
          {hasOrder && data.events ? (
            <Lineup event={event} events={data.events} stages now={data.now} />
          ) : (
            <StateNotice title="공연표 공개 전입니다" className={styles.columnNotice}>출연진과 시간표는 공개되는 대로 이곳에 표시됩니다.</StateNotice>
          )}
        </div>
      </section>
      <div className={styles.sessionSide}>
        {!request && (
          <section className={styles.sessionBriefing} data-surface="inset" aria-label="이벤트 소개">
            <p className={styles.columnHead}><b aria-hidden="true">Briefing</b><span>이벤트 소개</span>{bilingual(event.description, event.invitationLines) && <LanguageToggle />}</p>
            <TextPages
              paragraphs={invitation.length ? [...briefing, '초대 안내', ...invitation] : briefing}
              language={language}
              label="이벤트 소개"
              empty="이벤트 소개는 공개되는 대로 이곳에 표시됩니다."
            />
          </section>
        )}
        <section className={styles.sessionAccess} data-surface="paper" aria-label="참여 안내" data-origin="">
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
