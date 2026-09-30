'use client';
import Link from 'next/link';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, publicArtists, statusLabel } from '@/features/events/model';
import { EventCountdown } from '@/features/home/EventCountdown';
import { Action, BrandText, Chip, Facts, Loading, StateNotice } from '@/features/ui/Ui';
import { stageConfig } from '../config';
import { FitTitle } from '../FitTitle';
import { RailFace } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** `D-12`, `D-DAY`, or the state once the session has started. */
export function dayMark(event: TerminalEvent, now: Date) {
  if (event.status === 'LIVE') return 'LIVE';
  if (event.status === 'ARCHIVED') return 'ARCHIVE';
  const start = getEventDateTime(event).getTime();
  if (!Number.isFinite(start)) return 'TBA';
  const days = Math.ceil((start - now.getTime()) / 86_400_000);
  return days <= 0 ? 'D-DAY' : `D-${days}`;
}

/**
 * The next-session plate. It has no open state of its own: pressing it opens that session, and
 * the session's element sets out from this plate.
 */
export function NextPlate({ mode, data, query }: PlateProps) {
  const event = data.next;
  if (mode !== 'tile') {
    return (
      <RailFace
        href={event ? eventHref(event.id) : null}
        name="NEXT"
        title={event ? `다음 행사 ${event.session}` : '다음 행사 미정'}
        meta={event ? `${event.id} · ${dayMark(event, data.now)}` : 'TBA'}
        carrier={event ? `event:${event.id}` : undefined}
      />
    );
  }
  if (!data.events) {
    return (
      <div className={styles.tile}>
        {query.isError ? <StateNotice error title="행사 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />}
      </div>
    );
  }
  if (!event) {
    return (
      <section className={styles.next} aria-label="대표 행사">
        <StateNotice title="공개된 행사가 아직 없습니다">
          <div className={styles.keys}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      </section>
    );
  }
  const artists = publicArtists(event);
  const carrier = `event:${event.id}`;
  return (
    <section className={styles.next} aria-label="대표 행사" data-origin="">
      {stageConfig.rings && <i className={styles.rings} aria-hidden="true" />}
      <header className={styles.nextHead}>
        <p className={styles.nextLabel} aria-hidden="true">{event.status === 'ARCHIVED' ? 'Last session' : 'Next session'}</p>
        <span className={styles.tileChips} aria-hidden="true">
          <Chip solid>{statusLabel(event.status)}</Chip>
          <Chip>{event.id}</Chip>
        </span>
      </header>
      {event.status === 'ARCHIVED' && <p className={styles.noUpcoming}>다음 행사 미정</p>}
      <h2 className={styles.nextTitle}>
        <Link href={eventHref(event.id)} className={styles.stretch} data-carrier={carrier} scroll={false}>
          <FitTitle as="span" text={event.session} maxLines={2} minPx={32} className={styles.nextSession}>
            <BrandText text={event.session} />
          </FitTitle>
        </Link>
      </h2>
      {event.subtitle && <p className={styles.nextSubtitle}>{event.subtitle}</p>}
      <EventCountdown event={event} />
      <div className={styles.nextGrid}>
        <div className={styles.nextSchedule}>
          <p className={styles.sub} aria-hidden="true">Schedule</p>
          <Facts
            rows={[
              ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
              ['장소', event.venue],
              ['지역', event.district],
            ]}
          />
        </div>
        <div className={styles.nextLineup}>
          <p className={styles.sub} aria-hidden="true">Lineup</p>
          <ul className={styles.lineupCells}>
            {artists.length
              ? artists.map(artist => (
                  <li key={artist.id}>
                    <b>{artist.name}</b>
                    <small aria-hidden="true">{artist.dock ? `STAGE ${artist.dock}` : 'STAGE TBA'}</small>
                  </li>
                ))
              : Array.from({ length: 4 }, (_, index) => (
                  <li key={index} data-empty="">
                    <b>{index === 0 ? '공개 전' : '----'}</b>
                    <small aria-hidden="true">TBA</small>
                  </li>
                ))}
          </ul>
        </div>
      </div>
      <div className={`${styles.keys} ${styles.nextKeys}`}>
        <Action primary href={eventHref(event.id)} carrier={carrier}>행사 상세 보기</Action>
        <Action href="/signal">소식 신청</Action>
      </div>
    </section>
  );
}
