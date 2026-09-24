'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getArchivedOrElapsedEvents, getFutureUpcomingEvent, getLiveEvents } from '@/lib/events/lifecycle';
import { Ornament } from '@/features/display/Ornament';
import { LiveValue } from '@/features/display/Display';
import { Action, Facts, PageHeading, Panel, Pagination, StateNotice, ui } from '@/features/ui/Ui';
import { EventsData } from './data';
import { eventHref, pageNumber, publicArtists, statusLabel } from './model';
import { EventRecord } from './EventRecord';
import styles from './events.module.css';
export function Events() {
  const params = useSearchParams();
  return <><PageHeading title="이벤트"/><EventsData>{(events,now) => {
    const live = getLiveEvents(events,now);
    const upcoming = events.filter(event => event.status === 'UPCOMING').sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id.localeCompare(b.id));
    const archived = getArchivedOrElapsedEvents(events,now);
    const ordered = [...live,...upcoming,...archived];
    const totalPages = Math.ceil(ordered.length/4);
    const page = Math.min(pageNumber(params.get('page')),Math.max(1,totalPages));
    const next = getFutureUpcomingEvent(events,now);
    return <div className={styles.directory}>
      <div>{ordered.length ? <div className={styles.cards}>{ordered.slice((page-1)*4,page*4).map(event => {
        const artists = publicArtists(event);
        return <Link data-readout-panel="" data-event-state={event.status} key={event.id} className={styles.card} href={eventHref(event.id)}>
          <div className={styles.cardHeader}><div><small>{event.id} / {event.date}</small><h2>{event.session}</h2></div><span className={styles.recordStamp}><i aria-hidden="true"/>{statusLabel(event.status)}</span></div>
          {event.subtitle && <p>{event.subtitle}</p>}<p>{event.venue} · {event.time.replace(' KST','')} KST</p>
          {artists.length ? <ul className={styles.cardArtists}>{artists.map(artist => <li key={artist.id}>{artist.name}</li>)}</ul> : <Ornament variant="matrix" compact active={event.status !== 'ARCHIVED'}/>}
          <div className={styles.cardFooter}><span>{event.status === 'ARCHIVED' ? '전체 행사 기록' : '행사 상세 보기'}</span><span className={styles.cardSignal} aria-hidden="true"><i/><i/><i/><i/></span></div>
        </Link>;
      })}</div> : <StateNotice title="공개된 행사가 아직 없습니다"><Action href="/signal">다음 행사 소식 신청</Action></StateNotice>}
        <Pagination page={page} totalPages={totalPages} href={page => `/events?page=${page}`}/>
      </div>
      <Panel title="이벤트 현황" code={`${events.length} EVENTS`} className={styles.directorySummary}>
        <Facts rows={[["진행 중",<LiveValue key="live" value={live.length}/>],["예정",<LiveValue key="upcoming" value={upcoming.length}/>],["지난 행사",<LiveValue key="archived" value={archived.length}/>]]}/>
        <Ornament active={!!next || live.length > 0}/>
        {next && <div className={styles.nextEvent}><p>다음 행사</p><Link href={eventHref(next.id)}>{next.session}</Link><p>{next.date} · {next.venue}</p></div>}
        <div className={ui.actions}><Action href="/signal">다음 행사 소식 신청</Action></div>
      </Panel>
    </div>;
  }}</EventsData></>;
}
export function EventDetail({ eventId }: { eventId: string }) {
  return <EventsData>{(events,now) => {
    const event = events.find(event => event.id === eventId);
    if (!event) return <><PageHeading title="행사를 찾을 수 없습니다"/><StateNotice error title="공개된 행사 기록이 없습니다"><Action href="/events">행사 목록으로</Action></StateNotice></>;
    return <><PageHeading title={event.session}/><EventRecord event={event} events={events} now={now}/></>;
  }}</EventsData>;
}
