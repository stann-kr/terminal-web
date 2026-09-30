'use client';

import Link from 'next/link';
import { buildArtistRecords } from '../artists/records';
import { EventState, RecordControls } from '../shared/Ui';
import { useRecordWindow } from '../shared/useRecordWindow';
import { href, isPublicArtist, type ScreenProps } from './data';
import './archive.css';

export function EventArchive({ events, t }: ScreenProps) {
  const archived = events.filter(event => event.status === 'ARCHIVED').sort((a, b) => b.date.localeCompare(a.date));
  const page = useRecordWindow(archived, 4, 2);
  const artists = buildArtistRecords(archived);
  const venues = [...new Set(archived.map(event => event.venue))];
  const years = [...new Set(archived.map(event => event.date.slice(0, 4)))].sort().reverse();
  const maximum = Math.max(1, ...years.map(year => archived.filter(event => event.date.startsWith(year)).length));
  return <div className="te-archive">
    <section className="te-manifests"><div className="te-heading"><h2 className="tm-section-title" data-view-title tabIndex={-1}>EVENT MANIFESTS_</h2><span>{String(archived.length).padStart(2, '0')} {t('개 행사', 'EVENTS')}</span></div>
      {archived.length ? <div className="te-deck-grid">{page.records.map(event => <Link scroll={false} href={href('gate', event.id)} className="te-deck" key={event.id}><div className="te-deck-header"><span>{event.id}</span><EventState event={event} t={t} /></div><h3>{event.session}</h3><p className="te-deck-title">{event.subtitle}</p><div className="te-deck-roster"><span className="tm-eyebrow">PUBLIC LINEUP</span><p>{event.artists.filter(isPublicArtist).map(artist => artist.name).join(' / ') || t('공개 기록 없음', 'No public records')}</p></div><dl><div><dt>DATE</dt><dd>{event.date}</dd></div><div><dt>VENUE</dt><dd>{event.venue}</dd></div></dl><span className="te-deck-open">{t('행사 기록 열기', 'Open event record')} ↗</span></Link>)}</div> : <p className="tm-box" role="status">{t('기록된 이벤트가 없습니다.', 'No event history.')}</p>}
      <RecordControls {...page} count={page.records.length} t={t} />
    </section>
    <aside className="te-analytics"><h2 className="tm-section-title">ARCHIVE OVERVIEW_</h2><dl className="te-totals"><div><dt>{t('행사', 'Events')}</dt><dd>{String(archived.length).padStart(2, '0')}</dd></div><div><dt>{t('아티스트', 'Artists')}</dt><dd>{String(artists.length).padStart(2, '0')}</dd></div><div><dt>{t('장소', 'Venues')}</dt><dd>{String(venues.length).padStart(2, '0')}</dd></div></dl>
      <section className="te-year-counts"><h3 className="tm-section-title">EVENTS BY YEAR_</h3>{years.map(year => { const count = archived.filter(event => event.date.startsWith(year)).length; return <div key={year}><span>{year}</span><span className="te-year-track" aria-hidden="true"><span style={{ width: `${count / maximum * 100}%` }} /></span><strong>{count}</strong></div>; })}</section>
      <section className="te-venues"><h3 className="tm-section-title">VENUE INDEX_</h3>{venues.map(venue => <p key={venue}>{venue}</p>)}</section>
      <Link scroll={false} className="tm-action tm-action-secondary" href={href('artists')}>{t('아티스트별 출연 기록', 'Artist appearance records')} ↗</Link>
    </aside>
  </div>;
}
