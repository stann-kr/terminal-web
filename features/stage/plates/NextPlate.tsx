'use client';
import Link from 'next/link';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { TerminalEvent } from '@/lib/events/types';
import { DataActivity } from '@/features/display/Display';
import { eventHref, publicArtists, statusLabel } from '@/features/events/model';
import { EventCountdown } from '@/features/events/EventCountdown';
import { Clock } from '@/features/shell/Clock';
import { Action, BrandText, Chip, Facts, Loading, StateNotice, ui } from '@/features/ui/Ui';
import { FitStack } from '../FitStack';
import { FitTitle } from '../FitTitle';
import { Rings } from '../Rings';
import { PlateStatus } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** `D-12`, `D-DAY`, or the state once the session has started. */
function dayMark(event: TerminalEvent, now: Date) {
  if (event.status === 'LIVE') return 'LIVE';
  if (event.status === 'ARCHIVED') return 'ARCHIVE';
  const start = getEventDateTime(event).getTime();
  if (!Number.isFinite(start)) return 'TBA';
  const days = Math.ceil((start - now.getTime()) / 86_400_000);
  return days <= 0 ? 'D-DAY' : `D-${days}`;
}

/**
 * The console's own plate: the TERMINAL wordmark and the readouts ride on top of it everywhere,
 * over the next session drawn as large as the plate is. The wordmark is a name, not a control.
 */
function BrandBar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.brandBar} data-compact={compact || undefined}>
      <p className={styles.brandMark}>
        <BrandText text="TERMINAL" />
      </p>
      {!compact && (
        <div className={styles.brandSystem}>
          <DataActivity />
          <Clock />
        </div>
      )}
    </div>
  );
}

/**
 * The next-session plate. It has no open state of its own: its session block opens that session,
 * and the session's element sets out from this plate.
 */
export function NextPlate({ mode, data, query, rings }: PlateProps) {
  const event = data.next;
  // A short plate (chip, tile, index) states its data in one line; a notice would not fit it.
  const short = mode !== 'hero' && mode !== 'panel';
  const body = () => {
    if (!data.events) {
      if (short) return <PlateStatus state={query.isError ? 'error' : 'loading'} text={query.isError ? '행사 기록을 불러오지 못했습니다' : '행사 기록을 불러오는 중'} retry={() => void query.refetch()} />;
      return query.isError ? <StateNotice error title="행사 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />;
    }
    if (!event) {
      if (short) return <PlateStatus state="empty" text="공개된 행사가 아직 없습니다" />;
      return (
        <StateNotice title="공개된 행사가 아직 없습니다">
          <div className={styles.keys}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      );
    }
    return <NextSession event={event} mode={mode} now={data.now} rings={rings} />;
  };
  return (
    <section className={styles.next} aria-label="대표 행사" data-density={mode} data-origin="">
      <BrandBar compact={mode === 'chip'} />
      {body()}
    </section>
  );
}

function NextSession({ event, mode, now, rings }: { event: TerminalEvent; mode: PlateProps['mode']; now: Date; rings?: PlateProps['rings'] }) {
  const carrier = `event:${event.id}`;
  const label = event.status === 'ARCHIVED' ? 'Last session' : 'Next session';
  if (mode === 'chip' || mode === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.nextChip}`} data-carrier={carrier} scroll={false}>
        <span className={styles.chipName} aria-hidden="true">NEXT</span>
        <FitTitle as="span" text={`${event.session} · ${event.id} · ${dayMark(event, now)}`} maxLines={1} minPx={12} className={styles.chipLine}>
          <span className={styles.srOnly}>다음 행사 </span>
          <BrandText text={event.session} />
          <span aria-hidden="true"> · {event.id} · {dayMark(event, now)}</span>
        </FitTitle>
      </Link>
    );
  }
  const artists = publicArtists(event);
  const schedule: [string, string][] = [
    ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
    ['장소', event.venue],
    ...(mode === 'hero' ? [['지역', event.district] as [string, string]] : []),
  ];
  // Everything under the wordmark is one link, built of flush sub-plates. When the plate is short
  // the least important sub-plates fold away (priority: higher folds first); nothing is clipped.
  return (
    <Link
      href={eventHref(event.id)}
      className={`${styles.card} ${styles.nextBlock}`}
      data-carrier={carrier}
      aria-label={`${label === 'Last session' ? '지난 행사' : '다음 행사'} ${event.session} 상세 보기`}
      scroll={false}
    >
      {rings && <Rings at={rings} under />}
      <FitStack as="span" className={styles.parts}>
        <span className={styles.part} data-priority="0">
          <span className={styles.nextHead} aria-hidden="true">
            <span className={styles.nextLabel}>{label}</span>
            <span className={styles.bandTags}>
              <Chip solid>{statusLabel(event.status)}</Chip>
              <Chip>{event.id}</Chip>
              <Chip>{dayMark(event, now)}</Chip>
            </span>
          </span>
          {event.status === 'ARCHIVED' && mode === 'hero' && <span className={styles.noUpcoming}>다음 행사 미정</span>}
          <FitTitle as="h2" text={event.session} maxLines={mode === 'tile' ? 2 : 3} minPx={mode === 'hero' ? 32 : 20} className={styles.nextSession}>
            <BrandText text={event.session} />
          </FitTitle>
        </span>
        {mode !== 'tile' && event.subtitle && (
          <span className={styles.part} data-priority="5">
            <span className={styles.nextSubtitle}>{event.subtitle}</span>
          </span>
        )}
        {mode !== 'tile' && (
          <span className={`${styles.part} ${styles.partFlush}`} data-priority="1">
            <EventCountdown event={event} />
          </span>
        )}
        <span className={styles.part} data-priority={mode === 'tile' ? '1' : '2'}>
          {mode === 'tile' ? <span className={styles.nextWhen}>{event.date} · {event.venue}</span> : <Facts rows={schedule} />}
        </span>
        {mode === 'hero' && (
          <span className={`${styles.part} ${styles.partFlush}`} data-priority="4">
            <span className={ui.band} aria-hidden="true"><span>Lineup</span></span>
            <ul className={styles.lineupCells}>
              {artists.length
                ? artists.map(artist => (
                    <li key={artist.id}>
                      <b>{artist.name}</b>
                      <small aria-hidden="true">{artist.dock ? `DOCK ${artist.dock}` : 'DOCK TBA'}</small>
                    </li>
                  ))
                : Array.from({ length: 4 }, (_, index) => (
                    <li key={index} data-empty="">
                      <b>{index === 0 ? '공개 전' : '----'}</b>
                      <small aria-hidden="true">TBA</small>
                    </li>
                  ))}
            </ul>
          </span>
        )}
        {mode === 'hero' && (
          <span className={`${styles.part} ${styles.partEnd}`} data-priority="3">
            <span className={styles.nextCta} aria-hidden="true">OPEN SESSION FILE</span>
          </span>
        )}
      </FitStack>
    </Link>
  );
}
