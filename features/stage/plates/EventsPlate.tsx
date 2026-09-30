'use client';
import Link from 'next/link';
import { getArchivedOrElapsedEvents, getLiveEvents } from '@/lib/events/lifecycle';
import { eventHref, statusLabel } from '@/features/events/model';
import { LiveValue } from '@/features/display/Display';
import { Action, BrandText, Loading, StateNotice } from '@/features/ui/Ui';
import { useStageMode } from '../usePaging';
import { ChipFace, FocusHead, HeadLink, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const pad = (value: number, size = 3) => String(value).padStart(size, '0');

/**
 * The session directory at every size: a chip, an index beside an open session, a summary with
 * session cells, or the whole list. Cells, index lines and rows are the sessions' own elements,
 * laid out by the stage under this plate's head.
 */
export function EventsPlate({ mode, state, data, query }: PlateProps) {
  const stageMode = useStageMode();
  const events = data.ordered;
  const count = events.length;
  const archived = data.events ? getArchivedOrElapsedEvents(data.events, data.now).length : 0;
  const failure = !data.events && (query.isError ? <StateNotice error title="행사 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />);

  if (mode === 'chip') return <ChipFace href="/events" name="EVENTS" title="이벤트" meta={`${pad(count)} REC`} />;
  if (mode === 'index') {
    return (
      <div className={styles.face}>
        <HeadLink href="/events" label="Events" title="이벤트 목록" tags={<Tags items={[`${pad(count)} REC`]} />} heading="p" />
        {failure}
      </div>
    );
  }
  if (mode === 'panel' || mode === 'tile') {
    return (
      <div className={styles.face}>
        <HeadLink href="/events" label="Events" title="이벤트" tags={<Tags items={[`${pad(count)} SESSIONS`, `${pad(archived)} PAST`]} />} />
        {failure}
        {/* Before the stage is laid out (server, no script) the cells are drawn here instead. */}
        {stageMode !== 'stage' && count > 0 && (
          <ul className={styles.inlineCells}>
            {events.slice(0, 4).map(event => (
              <li key={event.id}>
                <Link href={eventHref(event.id)} className={`${styles.card} ${styles.eventCell}`} data-state={event.status}>
                  <span className={styles.cellCode} aria-hidden="true">{event.id}</span>
                  <span className={styles.cellName}><BrandText text={event.session} /></span>
                  <span className={styles.cellState}>{statusLabel(event.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const live = data.events ? getLiveEvents(data.events, data.now).length : 0;
  const upcoming = events.filter(event => event.status === 'UPCOMING').length;
  const years = [...new Set(events.map(event => event.date.slice(0, 4)))].sort().reverse();
  const venues = [...new Set(events.map(event => event.venue).filter(Boolean))];
  const page = state.view === 'plate' ? state.page : 1;
  const missing = state.view === 'plate' ? state.missing : undefined;
  return (
    <div className={styles.face}>
      <FocusHead label="Events" title="이벤트" tags={<Tags items={[`${pad(count)} RECORDS`, `PAGE ${pad(page, 2)}`]} />}>
        {missing ? (
          <p className={styles.missing} role="alert">
            <b aria-hidden="true">ERROR</b> ‘{missing.id}’ 행사 기록을 찾을 수 없습니다. 아래 목록에서 다시 찾아 주세요.
          </p>
        ) : (
          <div className={styles.summary}>
            <dl className={styles.counts}>
              <div><dt>진행 중</dt><dd><LiveValue value={live} /></dd></div>
              <div><dt>예정</dt><dd><LiveValue value={upcoming} /></dd></div>
              <div><dt>지난 행사</dt><dd><LiveValue value={archived} /></dd></div>
            </dl>
            <span className={styles.bandTags} aria-hidden="true">
              <Tags items={[...years, ...venues]} />
            </span>
          </div>
        )}
      </FocusHead>
      {failure}
      {data.events && !count && (
        <StateNotice title="공개된 행사가 아직 없습니다">
          <Action href="/signal">다음 행사 소식 신청</Action>
        </StateNotice>
      )}
    </div>
  );
}
