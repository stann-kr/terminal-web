'use client';
import Link from '@/features/ui/RouteLink';
import type { TerminalEvent } from '@/lib/events/types';
import { AccessRequest } from '@/features/access/Access';
import { AccessStatus, EventActions, EventFacts, Lineup, SessionKeys } from '@/features/events/EventRecord';
import { bilingual, eventHref, eventSubtitle, isRuleLine, paragraphs, publicArtists, sessionShort, statusLabel } from '@/features/events/model';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { Arrow, BrandText, StateNotice, type Surface } from '@/features/ui/Ui';
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
  return event.status === 'ARCHIVED' ? 'paper' : 'feature';
}

/** A session's sub-plate inside the directory plate: a summary cell, a directory row, or an index line. */
export function EventItem({ event, shape, current = false, apply = false }: { event: TerminalEvent; shape: ItemShape; current?: boolean; /** Guest requests are open: a row carries the key beside it. */ apply?: boolean }) {
  const carrier = `event:${event.id}`;
  if (shape === 'cell') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventCell}`} data-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={sessionShort(event.session)} maxLines={1} minPx={12} className={styles.cellName} arrow="in"><BrandText text={sessionShort(event.session)} /></FitTitle>
        <span className={styles.cellState}>{statusLabel(event.status)}</span>
        {/* When and where, under the name; a low cell leaves it out. */}
        <span className={styles.cellWhen}>{event.date} · {event.time.replace(' KST', '') || 'TBA'} · {event.venue}</span>
      </Link>
    );
  }
  if (shape === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.indexLine}`} data-carrier={carrier} aria-current={current ? 'page' : undefined} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={sessionShort(event.session)} maxLines={1} minPx={12} className={styles.cellName} arrow="in"><BrandText text={sessionShort(event.session)} /></FitTitle>
      </Link>
    );
  }
  if (shape === 'row') {
    const artists = publicArtists(event).map(artist => artist.name).join(' · ');
    const subtitle = eventSubtitle(event);
    const when = `${event.date} ${event.time.replace(' KST', '')} KST`;
    const row = (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventRow}`} data-event-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.rowId}>{event.id}</span>
        <span className={styles.rowMain}>
          <FitTitle as="h2" text={sessionShort(event.session)} maxLines={1} minPx={16} className={styles.rowName} arrow="in">
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
        <span className={styles.rowState}>{event.status === 'ARCHIVED' ? <>기록 보기<Arrow /></> : statusLabel(event.status)}</span>
      </Link>
    );
    if (!apply) return row;
    // The key stands beside the row's link, never inside it (a link holds no other link).
    return (
      <div className={styles.rowWrap}>
        {row}
        <Link href={`${eventHref(event.id)}/request`} className={`${styles.card} ${styles.rowKey}`} data-surface="paper" data-carrier={carrier} scroll={false}>
          게스트 신청<Arrow />
        </Link>
      </div>
    );
  }
  return null;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** `11-28 (토) 23:00`: the month and day with the weekday, and the start time. */
function shortWhen(event: TerminalEvent) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  const time = event.time.replace(' KST', '');
  if (!match) return `${event.date} ${time}`.trim();
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return `${match[2]}-${match[3]} (${WEEKDAYS[day]}) ${time}`.trim();
}

/**
 * The session file a row grows into: overview, running order, and the access panel over the
 * briefing. On `/request` the access panel opens into the guest form and the briefing folds away.
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
        <p className={styles.sessionState} aria-hidden="true">
          <span data-event-state={event.status}>{statusLabel(event.status)}</span>
          <span>{event.id}</span>
        </p>
        <FitTitle as="h1" id={`session-${event.id}`} heading={current} text={sessionShort(event.session)} maxLines={3} minPx={28} className={styles.sessionTitle}>
          <BrandText text={sessionShort(event.session)} />
        </FitTitle>
        {eventSubtitle(event) && <p className={styles.sessionSubtitle}>{eventSubtitle(event)}</p>}
        {/* A phone reads the date and the place in two cells instead of the fact bands. */}
        <dl className={styles.sessionCells}>
          <div><dt>일시 / KST</dt><dd>{shortWhen(event)}</dd></div>
          <div><dt>장소</dt><dd>{event.venue}</dd></div>
        </dl>
        <EventFacts event={event} modular />
      </div>
      <div className={styles.sessionKeyRow}>
        <SessionKeys event={event} />
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
        <section className={styles.sessionAccess} data-surface="paper" aria-label="참여 안내" data-origin="">
          {request ? (
            <>
              <p className={styles.columnHead}>
                <b aria-hidden="true">Access</b>
                <span>게스트 신청</span>
                <Link href={eventHref(event.id)} className={styles.closeKey} scroll={false}>
                  신청 닫기
                  <svg className={styles.closeMark} viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                </Link>
              </p>
              <div className={styles.fitColumn} data-fit="">
                <AccessRequest eventId={event.id} />
              </div>
            </>
          ) : (
            <>
              <p className={styles.columnHead}>
                <b aria-hidden="true">Access</b>
                <span>참여 안내</span>
                {data.events && <AccessStatus event={event} events={data.events} now={data.now} />}
              </p>
              <div className={styles.fitColumn} data-fit="">
                {data.events && <EventActions event={event} events={data.events} now={data.now} />}
              </div>
            </>
          )}
        </section>
        {!request && (
          <section className={styles.sessionBriefing} data-surface="inset" aria-label="이벤트 소개">
            <p className={styles.columnHead}><b aria-hidden="true">Briefing</b><span>이벤트 소개</span>{bilingual(event.description, event.invitationLines) && <LanguageToggle />}</p>
            <TextPages
              paragraphs={invitation.length ? [...briefing, '초대 안내', ...invitation] : briefing}
              language={language}
              label="이벤트 소개"
              empty="이벤트 소개는 공개되는 대로 이곳에 표시됩니다."
              more
            />
          </section>
        )}
      </div>
    </article>
  );
}
