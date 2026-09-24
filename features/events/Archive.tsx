'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildArtistArchive } from '@/features/artists/model';
import { Facts, PageHeading, Panel, Pagination, StateNotice } from '@/features/ui/Ui';
import { EventsData } from './data';
import { eventHref, pageNumber, publicArtists } from './model';
import styles from './events.module.css';
export function Archive() {
  const params = useSearchParams();
  return <><PageHeading title="지난 밤의 기록"/><EventsData>{events => {
    const archived = events.filter(event => event.status === 'ARCHIVED').sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const totalPages = Math.ceil(archived.length/4), page = Math.min(pageNumber(params.get('page')),Math.max(1,totalPages));
    const profiles = buildArtistArchive(archived), fullyMapped = profiles.every(profile => profile.verified);
    const venues = [...new Set(archived.map(event => event.venue))];
    return <div className={styles.archive}>
      <div>{archived.length ? <div className={styles.cards}>{archived.slice((page-1)*4,page*4).map(event => <Link data-readout-panel="" key={event.id} className={styles.card} href={eventHref(event.id)}>
        <div className={styles.cardHeader}><div><small>{event.id} / {event.date}</small><h2>{event.session}</h2></div><span className={styles.recordStamp}>ARCHIVED</span></div>
        <p>{event.subtitle}</p><p>{event.venue} · {event.time.replace(' KST','')} KST</p>
        <ul>{publicArtists(event).map(artist => <li key={artist.id}>{artist.name}</li>)}</ul>
        <span>전체 행사 기록</span>
      </Link>)}</div> : <StateNotice title="아직 지난 행사 기록이 없습니다"/>}
        <Pagination page={page} totalPages={totalPages} href={page => `/archive?page=${page}`}/>
      </div>
      <Panel title="전체 기록 집계" code="ALL YEARS" className={styles.archiveSummary}>
        <Facts rows={[["행사",archived.length],[fullyMapped ? '공개 아티스트' : '공개 출연 기록',fullyMapped ? profiles.length : archived.reduce((sum,event) => sum+publicArtists(event).length,0)],...venues.map(venue => [venue, archived.filter(event => event.venue === venue).length] as const)]}/>
      </Panel>
    </div>;
  }}</EventsData></>;
}
