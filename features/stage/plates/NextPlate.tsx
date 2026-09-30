'use client';
import Link from 'next/link';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { TerminalEvent } from '@/lib/events/types';
import { DataActivity } from '@/features/display/Display';
import { eventHref, publicArtists, statusLabel } from '@/features/events/model';
import { EventCountdown } from '@/features/events/EventCountdown';
import { Clock } from '@/features/shell/Clock';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { Action, BrandText, Chip, Facts, Loading, StateNotice } from '@/features/ui/Ui';
import { stageConfig } from '../config';
import { FitTitle } from '../FitTitle';
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
      <div className={styles.brandSystem}>
        {!compact && <DataActivity />}
        {!compact && <Clock />}
        <LanguageToggle />
      </div>
    </div>
  );
}

/**
 * The next-session plate. It has no open state of its own: its session block opens that session,
 * and the session's element sets out from this plate.
 */
export function NextPlate({ mode, data, query }: PlateProps) {
  const event = data.next;
  const body = () => {
    if (!data.events) {
      return query.isError ? <StateNotice error title="행사 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />;
    }
    if (!event) {
      return (
        <StateNotice title="공개된 행사가 아직 없습니다">
          <div className={styles.keys}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      );
    }
    return <NextSession event={event} mode={mode} now={data.now} />;
  };
  return (
    <section className={styles.next} aria-label="대표 행사" data-density={mode} data-origin="">
      {stageConfig.rings && (mode === 'hero' || mode === 'panel') && <i className={styles.rings} aria-hidden="true" />}
      <BrandBar compact={mode === 'chip'} />
      {body()}
    </section>
  );
}

function NextSession({ event, mode, now }: { event: TerminalEvent; mode: PlateProps['mode']; now: Date }) {
  const carrier = `event:${event.id}`;
  const label = event.status === 'ARCHIVED' ? 'Last session' : 'Next session';
  if (mode === 'chip' || mode === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.nextChip}`} data-carrier={carrier} scroll={false}>
        <span className={styles.chipName} aria-hidden="true">NEXT</span>
        <span className={styles.chipTitle}>
          <span className={styles.srOnly}>다음 행사 </span>
          <BrandText text={event.session} />
        </span>
        <span className={styles.chipMeta} aria-hidden="true">{event.id} · {dayMark(event, now)}</span>
      </Link>
    );
  }
  const artists = publicArtists(event);
  // Everything under the wordmark is one link: it lights up whole and opens the session.
  return (
    <Link
      href={eventHref(event.id)}
      className={`${styles.card} ${styles.nextBlock}`}
      data-carrier={carrier}
      aria-label={`${label === 'Last session' ? '지난 행사' : '다음 행사'} ${event.session} 상세 보기`}
      scroll={false}
    >
      <span className={styles.nextHead} aria-hidden="true">
        <span className={styles.nextLabel}>{label}</span>
        <span className={styles.bandTags}>
          <Chip solid>{statusLabel(event.status)}</Chip>
          <Chip>{event.id}</Chip>
          {mode !== 'hero' && <Chip>{dayMark(event, now)}</Chip>}
        </span>
      </span>
      {event.status === 'ARCHIVED' && mode === 'hero' && <span className={styles.noUpcoming}>다음 행사 미정</span>}
      <FitTitle as="h2" text={event.session} maxLines={mode === 'tile' ? 2 : 3} minPx={mode === 'hero' ? 32 : 20} className={styles.nextSession}>
        <BrandText text={event.session} />
      </FitTitle>
      {mode !== 'tile' && event.subtitle && <span className={styles.nextSubtitle}>{event.subtitle}</span>}
      {mode === 'tile' && <span className={styles.nextWhen}>{event.date} · {event.venue}</span>}
      {mode !== 'tile' && <EventCountdown event={event} />}
      {mode === 'panel' && (
        <Facts
          rows={[
            ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
            ['장소', event.venue],
          ]}
        />
      )}
      {mode === 'hero' && (
        <span className={styles.nextGrid}>
          <span className={styles.nextSchedule}>
            <span className={styles.sub} aria-hidden="true">Schedule</span>
            <Facts
              rows={[
                ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
                ['장소', event.venue],
                ['지역', event.district],
              ]}
            />
          </span>
          <span className={styles.nextLineup}>
            <span className={styles.sub} aria-hidden="true">Lineup</span>
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
          </span>
          <span className={styles.nextCta} aria-hidden="true">OPEN SESSION FILE</span>
        </span>
      )}
    </Link>
  );
}
