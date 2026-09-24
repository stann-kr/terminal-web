'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getDefaultEvent } from '@/lib/events/lifecycle';
import { useLanguage } from '@/features/shell/Providers';
import { Action, FullText, PageHeading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { EventsData } from './data';
import { eventHref, paragraphs, statusLabel } from './model';
import { EventActions, EventFacts, EventRecord, Lineup } from './EventRecord';
import styles from './events.module.css';
export function Events() {
  const params = useSearchParams();
  const selectedId = params.get('selected');
  const { language } = useLanguage();
  return <><PageHeading code="02 / EVENTS" title="다음 만남"><p>진행 중이거나 예정된 행사입니다.<br/>행사를 선택해 공연표와 참여 안내를 확인하세요.</p></PageHeading><EventsData>{(events,now) => {
    const active = events.filter(event => event.status !== 'ARCHIVED').sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const event = selectedId ? active.find(event => event.id === selectedId) : getDefaultEvent(active,now);
    if (!active.length) return <StateNotice title="다음 행사 미정"><p>새로운 일정이 정해지면 안내하겠습니다. 지난 행사의 공연표와 참여 아티스트는 기록에서 볼 수 있습니다.</p><div className={ui.actions}><Action primary href="/archive">지난 행사 기록</Action><Action href="/signal">다음 행사 소식 신청</Action></div></StateNotice>;
    return <div className={styles.explorer}><Panel title="행사 선택" code={`${active.length} EVENTS`}><ul className={styles.eventList}>{active.map(item => <li key={item.id}><Link href={`/events?selected=${encodeURIComponent(item.id)}`} aria-current={event?.id === item.id ? true : undefined} scroll={false}><small>{statusLabel(item.status)} / {item.id}</small><strong>{item.session}</strong><small>{item.date} · {item.venue}</small></Link></li>)}</ul></Panel>{event ? <><Panel title="선택한 행사" code={event.id} className={styles.selectedRecord}><h2 className={styles.heroTitle}>{event.session}</h2><p className={styles.subtitle}>{event.subtitle}</p><EventFacts event={event}/><Lineup event={event} events={events}/><div className={ui.actions}><Action primary href={eventHref(event.id)}>행사 상세 / 전체 기록</Action></div></Panel><div className={ui.stack}><Panel title="소개"><FullText language={language} paragraphs={paragraphs(event.description,language)}/></Panel><Panel title="참여 안내"><EventActions event={event} events={events} now={now}/></Panel></div></> : <StateNotice title="선택한 행사는 이 목록에 없습니다"><p>왼쪽에서 다른 행사를 선택하거나 기록을 확인해 주세요.</p><Action href="/archive">행사 기록</Action></StateNotice>}</div>;
  }}</EventsData></>;
}
export function EventDetail({ eventId }: { eventId: string }) {
  return <EventsData>{(events,now) => {
    const event = events.find(event => event.id === eventId);
    if (!event) return <><PageHeading code="EVENT / NOT FOUND" title="행사를 찾을 수 없습니다"/><StateNotice error title="공개된 행사 기록이 없습니다"><p>주소가 변경되었거나 공개되지 않은 행사입니다.</p><Action href="/events">행사 목록으로</Action></StateNotice></>;
    return <><PageHeading code={`EVENT RECORD / ${event.id}`} title={event.session}><p>{event.subtitle}</p><Link href={event.status === 'ARCHIVED' ? '/archive' : '/events'}>← {event.status === 'ARCHIVED' ? '행사 기록' : '이벤트 목록'}</Link></PageHeading><EventRecord event={event} events={events} now={now}/></>;
  }}</EventsData>;
}
