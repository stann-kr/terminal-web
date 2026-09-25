'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EventsData } from '@/features/events/data';
import { eventHref, pageNumber, paragraphs, statusLabel } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import { Action, FullText, PageHeading, Pagination, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { SignalText } from '@/features/display/Display';
import { artistHref, buildArtistArchive } from './model';
import { ArtistGlyph } from './ArtistGlyph';
import styles from './artists.module.css';
export function Artists() {
  const params = useSearchParams();
  return <><PageHeading title="함께한 아티스트"/><EventsData>{events => {
    const profiles = buildArtistArchive(events).sort((a,b) => a.name.localeCompare(b.name,'ko') || a.key.localeCompare(b.key));
    const totalPages = Math.ceil(profiles.length/12), page = Math.min(pageNumber(params.get('page')), Math.max(totalPages,1));
    return <>
      <p data-readout-row="" className={styles.count}>{profiles.length}개 기록</p>
      {profiles.length ? <div className={styles.grid}>{profiles.slice((page-1)*12,page*12).map(profile => <Link data-readout-panel="" data-upcoming={profile.appearances.some(row => row.event.status !== 'ARCHIVED')} data-featured={profile.key === 'stann-lumo' || undefined} className={styles.cell} key={profile.key} href={artistHref(profile.key)}>
        <span className={styles.cellHeader}><span>ARTIST / {profile.origin}</span><SignalText active={profile.appearances.some(row => row.event.status !== 'ARCHIVED')}>{profile.appearances.some(row => row.event.status === 'LIVE') ? 'LIVE 출연' : profile.appearances.some(row => row.event.status === 'UPCOMING') ? '예정 출연' : '출연 기록'}</SignalText></span>
        <ArtistGlyph name={profile.name}/><h2>{profile.name}</h2>
      </Link>)}</div> : <StateNotice title="아직 공개된 아티스트 기록이 없습니다"/>}
      <Pagination page={page} totalPages={totalPages} href={page => `/artists?page=${page}`}/><div className={styles.registryEnd} aria-hidden="true"/>
    </>;
  }}</EventsData></>;
}
export function ArtistDetail({ artistKey }: { artistKey: string }) {
  const { language } = useLanguage();
  return <EventsData>{events => {
    const profile = buildArtistArchive(events).find(profile => profile.key === artistKey);
    if (!profile) return <><PageHeading title="아티스트 기록을 찾을 수 없습니다"/><StateNotice error title="공개된 출연 이력이 없습니다"><Action href="/artists">전체 아티스트 보기</Action></StateNotice></>;
    const biography = profile.appearances.find(row => paragraphs(row.artist.description,language).length);
    return <><PageHeading title={profile.name}/><div className={styles.detail}><Panel title={profile.name} code={profile.origin}><div className={styles.profileSignal} aria-hidden="true"><span>ARTIST</span><strong className={styles.profileName}>{profile.name}</strong><strong>{profile.origin}</strong><i/><i/><i/></div><div className={ui.actions}><Action href="/artists">전체 아티스트</Action></div></Panel><Panel title="출연 기록" code="RECORDS" className={styles.chronology}><ol className={styles.timeline}>{profile.appearances.map(({ event,artist }) => <li key={`${event.id}:${artist.id}`}><time dateTime={event.date}>{event.date}</time><div><span className={styles.state}>{statusLabel(event.status)}</span><Link href={eventHref(event.id)}>{event.session}</Link><p>{event.venue} · {artist.dock} · {artist.time}</p><details><summary>당시 아티스트 소개</summary><FullText language={language} excerpt={false} paragraphs={paragraphs(artist.description,language)}/></details></div></li>)}</ol></Panel><Panel title="소개" code={language.toUpperCase()}><FullText language={language} excerpt={false} paragraphs={paragraphs(biography?.artist.description,language)}/>{biography && <p className={styles.note}>출처: <Link href={eventHref(biography.event.id)}>{biography.event.session} / {biography.event.date}</Link></p>}</Panel></div></>;
  }}</EventsData>;
}
