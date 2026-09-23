'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildArtistArchive } from '@/features/artists/model';
import { Facts, PageHeading, Panel, Pagination, StateNotice, ui } from '@/features/ui/Ui';
import { EventsData } from './data';
import { eventHref, pageHref, pageNumber, publicArtists } from './model';
import styles from './events.module.css';
export function Archive() {
  const params = useSearchParams();
  const year = params.get('year') ?? '', venue = params.get('venue') ?? '', search = params.get('q')?.trim() ?? '';
  return <><PageHeading code="04 / ARCHIVE" title="지난 밤의 기록"><p>행사와 출연진을 함께 보관합니다.<br/>공연표의 시간과 소개는 당시 공개된 기록입니다.</p></PageHeading><EventsData>{events => {
    const all = events.filter(event => event.status === 'ARCHIVED').sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const filtered = all.filter(event => (!year || event.date.startsWith(year)) && (!venue || event.venue === venue) && (!search || `${event.session} ${event.subtitle}`.toLowerCase().includes(search.toLowerCase())));
    const totalPages = Math.ceil(filtered.length/4), page = Math.min(pageNumber(params.get('page')),Math.max(1,totalPages));
    const profiles = buildArtistArchive(filtered), fullyMapped = profiles.every(profile => profile.verified);
    const venues = [...new Set(filtered.map(event => event.venue))];
    return <><form key={`${year}/${venue}/${search}`} action="/archive" className={ui.filters}><label>행사명<input name="q" defaultValue={search} placeholder="행사 검색"/></label><label>연도<select name="year" defaultValue={year}><option value="">전체 연도</option>{year && !all.some(event => event.date.startsWith(year)) && <option value={year}>{year} · 기록 없음</option>}{[...new Set(all.map(event => event.date.slice(0,4)))].map(value => <option key={value}>{value}</option>)}</select></label><label>장소<select name="venue" defaultValue={venue}><option value="">전체 장소</option>{venue && !all.some(event => event.venue === venue) && <option value={venue}>{venue} · 기록 없음</option>}{[...new Set(all.map(event => event.venue))].map(value => <option key={value}>{value}</option>)}</select></label><button className={ui.button}>적용</button><Link href="/archive" className={ui.button}>초기화</Link></form><div className={styles.archive}><div>{filtered.length ? <div className={styles.cards}>{filtered.slice((page-1)*4,page*4).map(event => <Link key={event.id} className={styles.card} href={eventHref(event.id)}><small>{event.id} / {event.date}</small><h2>{event.session}</h2><p>{event.subtitle}</p><p>{event.venue} · {event.time.replace(' KST','')} KST</p><ul>{publicArtists(event).map(artist => <li key={artist.id}>{artist.name}</li>)}</ul>{event.artists.length > publicArtists(event).length && <small>추가 공개 예정 {event.artists.length-publicArtists(event).length}팀</small>}<span>전체 행사 기록 ↗</span></Link>)}</div> : <StateNotice title={all.length ? '조건에 맞는 기록이 없습니다' : '아직 지난 행사 기록이 없습니다'}>필터를 바꾸거나 다음 행사 소식을 확인해 주세요.</StateNotice>}<Pagination page={page} totalPages={totalPages} href={page => pageHref('/archive',params,page)}/></div><Panel title="선택 범위 집계" code={year || 'ALL YEARS'}><p className={ui.muted}>{year || '전체 연도'} · {venue || '전체 장소'}{search && ` · “${search}” 검색`}</p><Facts rows={[["행사",filtered.length],[fullyMapped ? '공개 아티스트' : '공개 출연 기록',fullyMapped ? profiles.length : filtered.reduce((sum,event) => sum+publicArtists(event).length,0)],...venues.map(venue => [venue, filtered.filter(event => event.venue === venue).length] as const)]}/>{!fullyMapped && <p className={ui.muted}>인물이 확정되지 않은 기록은 출연별로 집계합니다.</p>}</Panel></div></>;
  }}</EventsData></>;
}
