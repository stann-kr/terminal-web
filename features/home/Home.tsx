'use client';
import Link from 'next/link';
import { getDefaultEvent, getFutureUpcomingEvent } from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { eventHref, paragraphs, publicArtists, statusLabel } from '@/features/events/model';
import { buildArtistArchive } from '@/features/artists/model';
import { useLanguage } from '@/features/shell/Providers';
import { HomeTerminal } from './terminal/HomeTerminal';
import { Action, Facts, FullText, PageHeading, Panel, StateNotice } from '@/features/ui/Ui';
import { LiveValue, SignalText } from '@/features/display/Display';
import { EventCountdown } from './EventCountdown';
import styles from './home.module.css';
export function Home() {
  const { language } = useLanguage();
  return <><PageHeading title="음악과 사람, 이어지는 기록"/><EventsData>{(events,now) => {
    const event = getFutureUpcomingEvent(events,now) ?? getDefaultEvent(events,now);
    const archived = events.filter(event => event.status === 'ARCHIVED');
    const profiles = buildArtistArchive(events);
    const fullyMapped = profiles.every(profile => profile.verified);
    const stats = [['/events','전체 행사',events.length],['/events','지난 행사',archived.length],['/artists',fullyMapped ? '공개 아티스트' : '공개 출연 기록',fullyMapped ? profiles.length : events.reduce((count,event) => count + publicArtists(event).length,0)]] as const;
    return <div className={styles.dashboard}><Panel title="축적된 기록" code="INDEX" className={styles.index}><ul className={styles.stats}>{stats.map(([href,label,count]) => <li key={label}><Link href={href}><span>{label}</span><strong><LiveValue value={String(count).padStart(2,'0')}/></strong></Link></li>)}</ul><div className={styles.statusMix}><p className={styles.smallHeading}>EVENT STATUS / 전체 행사</p>{(['LIVE','UPCOMING','ARCHIVED'] as const).map(status => { const count = events.filter(event => event.status === status).length; return <div key={status}><SignalText active={count > 0 && status !== 'ARCHIVED'}>{status}</SignalText><span className={styles.statusTrack} aria-hidden="true"><i data-readout-meter="" style={{width: `${events.length ? count / events.length * 100 : 0}%`}}/></span><span>{count}/{events.length}</span></div>; })}</div><div className={styles.intro}><p data-readout-row="">음악이 시작되고<br/>사람이 모이는 곳.</p></div><div className={styles.homeRegister} aria-hidden="true">{Array.from({length:12},(_,index) => <i key={index}/>)}</div><div className={styles.columnActions}><Action href="/about">TERMINAL 소개</Action></div></Panel>
      <section data-readout-panel="" className={styles.featured} aria-label="대표 행사">{event ? <><div data-readout-row="" className={styles.recordHeader}><SignalText active={event.status !== 'ARCHIVED'}>{statusLabel(event.status)}</SignalText><span>{event.id}</span></div>{event.status === 'ARCHIVED' && <p className={styles.noUpcoming}>다음 행사 미정</p>}<h2 data-readout-row="">{event.session}</h2><p data-readout-row="" className={styles.subtitle}>{event.subtitle}</p><EventCountdown event={event}/><div className={styles.homeScan} aria-hidden="true" data-active={event.status !== 'ARCHIVED'}><i/></div><Facts rows={[["일시 / KST",`${event.date} · ${event.time.replace(' KST','')}`],["장소",event.venue]]}/><ul className={styles.names}>{publicArtists(event).map(artist => <li key={artist.id}>{artist.name}</li>)}</ul><FullText language={language} paragraphs={paragraphs(event.description,language)}/><div className={styles.columnActions}><Action primary href={eventHref(event.id)}>행사 상세 보기</Action><Action href="/signal">소식 신청</Action></div></> : <StateNotice title="공개된 행사가 아직 없습니다"><div className={styles.columnActions}><Action href="/signal">소식 신청</Action><Action href="/about">소개</Action></div></StateNotice>}</section>
      <Panel title="COMMAND LOG_" code="TERMINAL"><HomeTerminal events={events} language={language}/></Panel></div>;
  }}</EventsData></>;
}
