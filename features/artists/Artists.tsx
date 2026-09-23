'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getEventDateTime } from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { eventHref, pageHref, pageNumber, paragraphs, statusLabel } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import { Action, Facts, FullText, PageHeading, Pagination, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { artistHref, buildArtistArchive } from './model';
import styles from './artists.module.css';
export function Artists() {
  const params = useSearchParams();
  const search = params.get('q')?.trim() ?? '', origin = params.get('origin') ?? '', sort = ['name','recent','count'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'name';
  return <><PageHeading code="03 / ARTISTS" title="함께한 아티스트"><p>공개된 출연 기록에서 이어지는 명부.<br/>아티스트를 선택해 참여 행사와 소개를 읽어보세요.</p></PageHeading><EventsData>{events => {
    const all = buildArtistArchive(events);
    const filtered = all.filter(profile => (!origin || profile.origin === origin) && profile.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b) => (sort === 'recent' ? getEventDateTime(b.appearances[0].event).getTime()-getEventDateTime(a.appearances[0].event).getTime() : sort === 'count' ? b.eventCount-a.eventCount : 0) || a.name.localeCompare(b.name,'ko') || a.key.localeCompare(b.key));
    const totalPages = Math.ceil(filtered.length/12), page = Math.min(pageNumber(params.get('page')), Math.max(totalPages,1));
    return <><form action="/artists" key={`${search}/${origin}/${sort}`} className={ui.filters}><label>이름 검색<input name="q" defaultValue={search} placeholder="아티스트 이름"/></label><label>출신<select name="origin" defaultValue={origin}><option value="">전체</option>{origin && !all.some(profile => profile.origin === origin) && <option value={origin}>{origin} · 기록 없음</option>}{[...new Set(all.map(profile => profile.origin))].sort().map(value => <option key={value}>{value}</option>)}</select></label><label>정렬<select name="sort" defaultValue={sort}><option value="name">이름순</option><option value="recent">최근 출연순</option><option value="count">참여 행사순</option></select></label><button className={ui.button}>적용</button><Link href="/artists" className={ui.button}>초기화</Link></form><p className={styles.count}>{filtered.length}개 기록 / 공개된 출연만 표시{all.some(profile => !profile.verified) && ' · 같은 이름의 미확정 출연은 별도 기록입니다.'}</p>{filtered.length ? <div className={styles.grid}>{filtered.slice((page-1)*12,page*12).map(profile => <Link className={styles.cell} key={profile.key} href={artistHref(profile.key)}><span className={styles.cellHeader}><span>{profile.origin}</span><span>{profile.appearances.some(row => row.event.status !== 'ARCHIVED') ? '예정 / 진행 출연' : '출연 기록'}</span></span><h2>{profile.name}</h2><Facts rows={[["참여 행사",`${profile.eventCount}회`],["최근 출연",profile.appearances[0].event.date]]}/><div className={styles.years}>{[...new Set(profile.appearances.map(row => row.event.date.slice(0,4)))].sort().map(year => <span key={year}>{year}</span>)}<span aria-hidden="true">↗</span></div></Link>)}</div> : <StateNotice title="조건에 맞는 아티스트가 없습니다">검색어나 출신 필터를 바꿔 주세요.</StateNotice>}<Pagination page={page} totalPages={totalPages} href={page => pageHref('/artists',params,page)}/></>;
  }}</EventsData></>;
}
export function ArtistDetail({ artistKey }: { artistKey: string }) {
  const { language } = useLanguage();
  return <EventsData>{events => {
    const profile = buildArtistArchive(events).find(profile => profile.key === artistKey);
    if (!profile) return <><PageHeading code="ARTIST / NOT FOUND" title="아티스트 기록을 찾을 수 없습니다"/><StateNotice error title="공개된 출연 이력이 없습니다"><Action href="/artists">전체 아티스트 보기</Action></StateNotice></>;
    const latest = profile.appearances[0], first = profile.appearances.at(-1)!;
    const biography = profile.appearances.find(row => paragraphs(row.artist.description,language).length);
    return <><PageHeading code={`ARTIST / ${profile.key}`} title={profile.name}><Link href="/artists">← 전체 아티스트</Link></PageHeading><div className={styles.detail}><Panel title="아티스트 정보"><Facts rows={[["출신",profile.origin],["참여 행사",`${profile.eventCount}회`],["첫 출연",first.event.date],["최근 출연",latest.event.date]]}/>{!profile.verified && <p className={styles.note}>인물 식별이 확정되지 않은 출연 기록입니다. 다른 동명 기록과 자동으로 합치지 않습니다.</p>}</Panel><Panel title="출연 연대기" code={`${profile.eventCount} EVENTS`}><ol className={styles.timeline}>{profile.appearances.map(({ event,artist }) => <li key={`${event.id}:${artist.id}`}><time>{event.date}</time><div><span className={styles.state}>{statusLabel(event.status)}</span><Link href={eventHref(event.id)}>{event.session} ↗</Link><p>{event.venue} · {artist.dock} · {artist.time}</p><details><summary>당시 아티스트 소개</summary><FullText excerpt={false} paragraphs={paragraphs(artist.description,language)}/></details></div></li>)}</ol></Panel><Panel title="소개" code={language.toUpperCase()}><FullText paragraphs={paragraphs(biography?.artist.description,language)}/>{biography && <p className={styles.note}>출처: <Link href={eventHref(biography.event.id)}>{biography.event.session} / {biography.event.date}</Link></p>}</Panel></div></>;
  }}</EventsData>;
}
