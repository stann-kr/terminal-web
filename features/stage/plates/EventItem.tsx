'use client';
import Link from '@/features/ui/RouteLink';
import type { TerminalEvent } from '@/lib/events/types';
import { AccessRequest } from '@/features/access/Access';
import { AccessStatus, EventActions, EventFacts, Lineup, SessionKeys } from '@/features/events/EventRecord';
import { bilingual, dayMark, eventHref, eventSubtitle, isRuleLine, paragraphs, publicArtists, sessionShort, shortWhen, statusLabel } from '@/features/events/model';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { Arrow, BrandText, StateNotice, type Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import { FitTitle } from '../FitTitle';
import type { ItemMode } from '../layout';
import type { StageState } from '../state';
import { Rings } from '../Rings';
import { TextPages } from '../TextPages';
import styles from './plates.module.css';

/** The shapes a session's sub-plate takes; `folded` keeps whichever shape it last had. */
export type ItemShape = Exclude<ItemMode, 'folded'>;

/** A session reads in its state colour as an open file; as a cell, row or line it is a dark record. */
export function sessionSurface(event: TerminalEvent): Surface {
  return event.status === 'ARCHIVED' ? 'paper' : 'feature';
}

/** A session's sub-plate inside the directory plate: a summary cell, a directory row, or an index line. */
export function EventItem({ event, shape, current = false, apply = false, lead = false, now }: {
  event: TerminalEvent;
  shape: ItemShape;
  current?: boolean;
  /** Guest requests are open: a row carries the key beside it. */
  apply?: boolean;
  /** The directory's leading row (the next session), tall, with its keys in its corner. */
  lead?: boolean;
  now?: Date;
}) {
  const carrier = `event:${event.id}`;
  if (shape === 'row' && lead) return <LeadRow event={event} apply={apply} now={now} />;
  if (shape === 'cell') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventCell}`} data-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
        <FitTitle as="span" text={sessionShort(event.session)} maxLines={1} minPx={12} className={styles.cellName} arrow="in"><BrandText text={sessionShort(event.session)} /></FitTitle>
        <span className={styles.cellState}>{statusLabel(event.status)}</span>
        {/* When and where, under the name; a low cell leaves it out. */}
        <span className={styles.cellWhen}>
          {event.status === 'ARCHIVED' && eventSubtitle(event)
            ? `${event.date} · ${eventSubtitle(event)}`
            : `${event.date} · ${event.time.replace(' KST', '') || 'TBA'} · ${event.venue}`}
        </span>
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
    const past = event.status === 'ARCHIVED';
    const row = (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventRow}`} data-event-state={event.status} data-carrier={carrier} scroll={false}>
        <span className={styles.rowId}>{event.id}</span>
        <span className={styles.rowMain}>
          {/* A past row reads its name and subtitle on one line; a coming one stacks them. */}
          {past ? (
            <FitTitle as="h2" text={`${sessionShort(event.session)} ${subtitle}`} maxLines={1} minPx={16} className={styles.rowName}>
              <BrandText text={sessionShort(event.session)} />
              {subtitle && <span className={styles.rowNameSub}> {subtitle}</span>}
            </FitTitle>
          ) : (
            <FitTitle as="h2" text={sessionShort(event.session)} maxLines={1} minPx={16} className={styles.rowName} arrow="in">
              <BrandText text={sessionShort(event.session)} />
            </FitTitle>
          )}
          {/* A narrow past row stacks them again, the subtitle carrying the way in. */}
          {subtitle && past && <span className={`${styles.rowSubtitle} ${styles.narrowSub}`} aria-hidden="true">{subtitle}<Arrow /></span>}
          {subtitle && !past && (
            <FitTitle as="span" text={subtitle} maxLines={1} minPx={14} className={styles.rowSubtitle}>
              {subtitle}
            </FitTitle>
          )}
          {artists && (
            <FitTitle as="span" text={artists} maxLines={1} minPx={12} className={styles.rowLine}>
              <span className={styles.rowArtists}><span className={styles.srOnly}>출연 </span>{artists}</span>
            </FitTitle>
          )}
          {/* A narrow coming row prints its code, time and venue here, on one fitted line. */}
          {!past && <FitTitle as="span" text={`${event.id} · ${when} · ${event.venue}`} maxLines={1} minPx={12} className={styles.rowNarrowMeta}>
            {event.id} · {when} · {event.venue}
          </FitTitle>}
        </span>
        <span className={styles.rowWhen}>
          {event.date}
          {!past && <small>{event.time.replace(' KST', '')} KST</small>}
        </span>
        {past ? (
          <span className={styles.rowMark}>{statusLabel(event.status)}</span>
        ) : (
          <FitTitle as="span" text={event.venue} maxLines={1} minPx={12} className={styles.rowVenue}>{event.venue}</FitTitle>
        )}
        <span className={styles.rowState} data-past={past || undefined}>{past ? <>기록 보기<Arrow /></> : statusLabel(event.status)}</span>
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

/**
 * The directory's leading row: the next session at length (state, name, subtitle, lineup; date,
 * time and venue), with the guest request and the file as keys in its lower right corner, beside
 * the row's link, never inside it.
 */
function LeadRow({ event, apply, now }: { event: TerminalEvent; apply: boolean; now?: Date }) {
  const carrier = `event:${event.id}`;
  const subtitle = eventSubtitle(event);
  const artists = publicArtists(event).map(artist => artist.name).join(' · ');

  return (
    <div className={styles.leadWrap}>
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventRow} ${styles.leadRow}`} data-event-state={event.status} data-carrier={carrier} scroll={false}>
        <Rings at={{ x: 0.62, y: 0.48 }} under />
        <span className={styles.rowId}>{event.id}</span>
        <span className={styles.leadMain}>
          <span className={styles.leadState}>
            {statusLabel(event.status)}
            {apply && <span className={styles.leadOpen}> · ACCESS OPEN</span>}
            {now && <> · {dayMark(event, now)}</>}
          </span>
          <FitTitle as="h2" text={sessionShort(event.session)} maxLines={1} minPx={20} className={styles.leadName}>
            <BrandText text={sessionShort(event.session)} />
          </FitTitle>
          {subtitle && <span className={styles.leadSubtitle}>{subtitle}</span>}
          <span className={styles.leadShort}>{shortWhen(event)} · {event.venue}</span>
          {artists && <span className={`${styles.rowLine} ${styles.rowArtists}`}><span className={styles.srOnly}>출연 </span>{artists}</span>}
        </span>
        <span className={styles.leadWhen}>
          <b>{event.date}</b>
          <small>{event.time.replace(' KST', '')} KST · {event.venue}</small>
        </span>
      </Link>
      {/* The row itself opens the session file; the one key beside it is the guest request while open. */}
      {apply && (
        <span className={styles.leadKeys}>
          <Link href={`${eventHref(event.id)}/request`} className={`${styles.card} ${styles.nextKey}`} data-surface="paper" data-carrier={carrier} scroll={false}>
            게스트 신청<Arrow />
          </Link>
        </span>
      )}
    </div>
  );
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
