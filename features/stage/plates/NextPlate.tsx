'use client';
import Link from '@/features/ui/RouteLink';
import type { Artist, TerminalEvent } from '@/lib/events/types';
import { getSlotTimes } from '@/lib/events/lifecycle';
import { DataActivity } from '@/features/display/Display';
import { accessAvailability, dayMark, eventHref, eventSubtitle, isSlotOn, runningOrder, sessionShort, statusLabel } from '@/features/events/model';
import { EventCountdown } from '@/features/events/EventCountdown';
import { Clock } from '@/features/shell/Clock';
import { Action, Arrow, BrandText, Chip, Facts, Loading, StateNotice } from '@/features/ui/Ui';
import { FitStack } from '../FitStack';
import { FitTitle } from '../FitTitle';
import { Rings } from '../Rings';
import { PlateStatus } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

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
      if (short) return <PlateStatus state={query.isError ? 'error' : 'loading'} text={query.isError ? '기록을 불러오지 못했습니다' : '기록을 불러오는 중'} retry={() => void query.refetch()} />;
      return query.isError ? <StateNotice error title="기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />;
    }
    if (!event) {
      if (short) return <PlateStatus state="empty" text="공개된 이벤트가 아직 없습니다" />;
      return (
        <StateNotice title="공개된 이벤트가 아직 없습니다">
          <div className={styles.keys}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      );
    }
    return <NextSession event={event} events={data.events} mode={mode} now={data.now} rings={rings} />;
  };
  return (
    <section className={styles.next} aria-label="대표 이벤트" data-density={mode} data-origin="">
      <BrandBar compact={mode === 'chip'} />
      {body()}
    </section>
  );
}

/** A slot's start as printed (`23:00`), or TBA while its time is not out. */
function startOf(event: TerminalEvent, artist: Artist) {
  return getSlotTimes(event, artist.time) ? artist.time.split(/\s*[-–]\s*/)[0] : 'TBA';
}

/** A dock's night, from its first start to its last end (`23:00 – 05:00`), as printed. */
function spanOf(slots: readonly Artist[]) {
  const times = slots.map(artist => artist.time.split(/\s*[-–]\s*/)).filter(parts => parts.length === 2);
  return times.length ? `${times[0][0]} – ${times[times.length - 1][1]}` : '';
}

function NextSession({ event, events, mode, now, rings }: { event: TerminalEvent; events: TerminalEvent[]; mode: PlateProps['mode']; now: Date; rings?: PlateProps['rings'] }) {
  const carrier = `event:${event.id}`;
  // Guest requests open 30 days ahead; the home plate says so, so nobody has to open the file to find out.
  const accessOpen = accessAvailability(event, events, now).canRequest;
  const subtitle = eventSubtitle(event);
  const label = { LIVE: 'Live session', UPCOMING: 'Next session', ARCHIVED: 'Last session' }[event.status];
  const spoken = { LIVE: '진행 중인 이벤트', UPCOMING: '다음 이벤트', ARCHIVED: '지난 이벤트' }[event.status];
  if (mode === 'chip' || mode === 'index') {
    return (
      <Link href={eventHref(event.id)} className={`${styles.card} ${styles.nextChip}`} data-carrier={carrier} scroll={false}>
        <span className={styles.chipName} aria-hidden="true">NEXT<Arrow /></span>
        <FitTitle as="span" text={`${event.id} · ${dayMark(event, now)}`} maxLines={1} minPx={12} className={styles.chipLine} arrow="in">
          <span className={styles.srOnly}>{spoken} <BrandText text={sessionShort(event.session)} /> </span>
          <span className={styles.linkName}>{event.id} · {dayMark(event, now)}</span>
        </FitTitle>
      </Link>
    );
  }
  // The lineup in running order; while the session runs, the slots the timetable is on lead the
  // plate's readouts so the home page says who is on without opening the file.
  const artists = runningOrder(event);
  const playing = artists.filter((artist) => isSlotOn(event, artist, now));
  // Once times are out the lineup reads as the night's running order, one slot per line.
  const timed = artists.some((artist) => getSlotTimes(event, artist.time));
  const dockOf = (artist: Artist) => (artist.dock ? `DOCK ${artist.dock}` : 'DOCK TBA');
  // The running order by dock, a column each, in the order the docks first play.
  const docks = [...new Set(artists.map(dockOf))].map(dock => [dock, artists.filter(artist => dockOf(artist) === dock)] as const);
  const schedule: [string, string][] = [
    ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
    ['장소', event.venue],
    ...(mode === 'hero' ? [['지역', event.district] as [string, string]] : []),
  ];
  // Everything under the wordmark is one link, built of flush sub-plates. When the plate is short
  // the least important sub-plates fold away (priority: higher folds first); nothing is clipped.
  const block = (
    <Link
      href={eventHref(event.id)}
      className={`${styles.card} ${styles.nextBlock}`}
      data-carrier={carrier}
      aria-label={`${spoken} ${sessionShort(event.session)}${subtitle ? ` ${subtitle}` : ''}${playing.length ? `, 시간표 기준 지금 순서 ${playing.map((artist) => artist.name).join(', ')}` : ''}${accessOpen ? ', 게스트 신청 접수 중' : ''} 상세 보기`}
      scroll={false}
    >
      {rings && <Rings at={rings} under />}
      <FitStack as="span" className={styles.parts}>
        <span className={styles.part} data-priority="0">
          <span className={styles.nextHead} aria-hidden="true">
            <span className={styles.nextLabel}>{label}</span>
            <span className={styles.bandTags}>
              <Chip solid>{statusLabel(event.status)}</Chip>
              {accessOpen && <Chip solid>ACCESS OPEN</Chip>}
              <Chip>{event.id}</Chip>
              <Chip>{dayMark(event, now)}</Chip>
            </span>
          </span>
          {event.status === 'ARCHIVED' && mode === 'hero' && <span className={styles.noUpcoming}>다음 이벤트 미정</span>}
          <FitTitle as="h2" text={sessionShort(event.session)} maxLines={mode === 'tile' ? 2 : 3} minPx={mode === 'hero' ? 32 : 20} className={styles.nextSession} arrow="in">
            <BrandText text={sessionShort(event.session)} />
          </FitTitle>
        </span>
        {mode !== 'tile' && subtitle && (
          <span className={styles.part} data-priority="5">
            <span className={styles.nextSubtitle}>{subtitle}</span>
          </span>
        )}
        {mode !== 'tile' && (
          <span className={`${styles.part} ${styles.partFlush}`} data-priority="1">
            <EventCountdown event={event} inline={mode === 'hero'} />
          </span>
        )}
        <span className={`${styles.part} ${mode === 'hero' ? styles.partFlush : ''}`} data-priority={mode === 'tile' ? '1' : '2'}>
          {mode === 'tile' ? (
            <span className={styles.nextWhen}>{event.date} · {event.venue}</span>
          ) : mode === 'hero' ? (
            <span className={styles.factCells}>
              {schedule.map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <b>{value || '미정'}</b>
                </span>
              ))}
            </span>
          ) : (
            <Facts rows={schedule} />
          )}
        </span>
        {mode === 'hero' && (
          <span className={`${styles.part} ${styles.partFlush} ${styles.partLineup}`} data-priority={playing.length ? '1' : '4'}>
            <span className={styles.lineupLabel} aria-hidden="true">
              <span>{timed ? 'Running order' : 'Lineup'}</span>
              <span>{playing.length > 0 ? '시간표 기준 지금 순서' : timed ? '공연표' : '출연'}</span>
            </span>
            {artists.length ? (
              <span className={styles.dockCols}>
                {docks.map(([dock, slots]) => (
                  <span key={dock} className={styles.dockCol}>
                    <span className={styles.dockHead} aria-hidden="true">
                      <span>{dock}</span>
                      {timed && <span>{spanOf(slots)}</span>}
                    </span>
                    <ol>
                      {slots.map(artist => (
                        <li key={artist.id} data-now={playing.includes(artist) || undefined}>
                          {timed && <small aria-hidden="true">{startOf(event, artist)}</small>}
                          <b>{artist.name}</b>
                          {playing.includes(artist) && <small aria-hidden="true">NOW</small>}
                        </li>
                      ))}
                    </ol>
                  </span>
                ))}
              </span>
            ) : (
              // How many play is not set until the lineup is out: one cell says so, not a guessed count.
              <ul className={styles.lineupCells}>
                <li data-empty="">
                  <b>공개 전</b>
                  <small aria-hidden="true">TBA</small>
                </li>
              </ul>
            )}
          </span>
        )}
      </FitStack>
    </Link>
  );
  if (mode !== 'hero') return block;
  // The plate's keys stand under the block, not inside its link (a link holds no other link): the
  // guest request while it is open, and the session file.
  return (
    <>
      {block}
      <span className={styles.nextKeys}>
        {accessOpen && (
          <Link href={`${eventHref(event.id)}/request`} className={`${styles.card} ${styles.nextKey}`} data-surface="paper" data-carrier={carrier} scroll={false}>
            게스트 신청<Arrow />
          </Link>
        )}
        <Link href={eventHref(event.id)} className={`${styles.card} ${styles.nextKey}`} data-key="file" data-carrier={carrier} scroll={false}>
          세션 파일 열기<Arrow />
        </Link>
      </span>
    </>
  );
}
