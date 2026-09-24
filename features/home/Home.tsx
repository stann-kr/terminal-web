'use client';
import Link from 'next/link';
import { getDefaultEvent } from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { eventHref, paragraphs, publicArtists, statusLabel } from '@/features/events/model';
import { artistHref, buildArtistArchive } from '@/features/artists/model';
import { useLanguage } from '@/features/shell/Providers';
import { Feed } from '@/features/transmit/Feed';
import { Action, Facts, FullText, PageHeading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import styles from './home.module.css';
export function Home() {
  const { language } = useLanguage();
  return <><PageHeading title="음악과 사람, 이어지는 기록"/><EventsData>{(events,now) => {
    const event = getDefaultEvent(events,now);
    const archived = events.filter(event => event.status === 'ARCHIVED');
    const profiles = buildArtistArchive(events);
    const fullyMapped = profiles.every(profile => profile.verified);
    const stats = [['/events','전체 행사',events.length],['/archive','지난 행사',archived.length],['/artists',fullyMapped ? '공개 아티스트' : '공개 출연 기록',fullyMapped ? profiles.length : events.reduce((count,event) => count + publicArtists(event).length,0)]] as const;
    return <div className={styles.dashboard}><Panel title="축적된 기록" code="INDEX"><ul className={styles.stats}>{stats.map(([href,label,count]) => <li key={label}><Link href={href}><span>{label}</span><strong>{String(count).padStart(2,'0')}</strong></Link></li>)}</ul><p className={ui.muted}>공개 출연 {events.reduce((count,event) => count + publicArtists(event).length,0)}건{!fullyMapped && ' · 미확정 인물 식별은 출연별로 표시합니다.'}</p><div className={styles.statusMix}><p className={styles.smallHeading}>EVENT STATUS / 전체 행사</p>{(['LIVE','UPCOMING','ARCHIVED'] as const).map(status => { const count = events.filter(event => event.status === status).length; return <div key={status}><span>{status}</span><span className={styles.statusTrack} aria-hidden="true"><i style={{width: `${events.length ? count / events.length * 100 : 0}%`}}/></span><span>{count}/{events.length}</span></div>; })}</div>{profiles.length > 0 && <div className={styles.peopleIndex}><p className={styles.smallHeading}>PUBLIC ARTISTS / 공개 명부</p><ul>{profiles.slice(0,12).map(profile => <li key={profile.key}><Link href={artistHref(profile.key)}>{profile.name}</Link></li>)}</ul></div>}<div className={styles.intro}><p>음악이 시작되고<br/>사람이 모이는 곳.</p><Action href="/about">TERMINAL 소개</Action></div></Panel>
      <section className={styles.featured} aria-label="대표 행사">{event ? <><div className={styles.recordHeader}><span>{statusLabel(event.status)}</span><span>{event.id}</span></div>{event.status === 'ARCHIVED' && <p className={styles.noUpcoming}>다음 행사 미정 / 최근 행사 기록</p>}<h2>{event.session}</h2><p className={styles.subtitle}>{event.subtitle}</p><Facts rows={[["일시 / KST",`${event.date} · ${event.time.replace(' KST','')}`],["장소",event.venue]]}/><ul className={styles.names}>{publicArtists(event).map(artist => <li key={artist.id}>{artist.name}</li>)}</ul>{event.artists.length > publicArtists(event).length && <p className={ui.muted}>추가 공개 예정 {event.artists.length-publicArtists(event).length}팀</p>}<FullText language={language} paragraphs={paragraphs(event.description,language)}/><div className={ui.actions}><Action primary href={eventHref(event.id)}>행사 상세 보기</Action><Action href="/signal">소식 신청</Action></div></> : <StateNotice title="공개된 행사가 아직 없습니다"><p>다음 만남의 소식을 기다려 주세요.</p><div className={ui.actions}><Action href="/signal">소식 신청</Action><Action href="/about">소개</Action></div></StateNotice>}</section>
      <Panel title="방문자 로그" code="TRANSMIT"><Feed limit={3}/><div className={ui.actions}><Action href="/transmit">전체 로그 / 글 남기기</Action></div></Panel></div>;
  }}</EventsData></>;
}
