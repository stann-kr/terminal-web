'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { biography, href, type ScreenProps } from '../events/data';
import { sourceExcerpt } from '../events/presentation';
import { useRecordWindow } from '../shared/useRecordWindow';
import { RecordControls } from '../shared/Ui';
import { DocumentReader } from '../shared/DocumentReader';
import { useReadoutMotion } from '../motion/useReadoutMotion';
import { focusNavigationTarget } from '../shell/useNavigationContinuity';
import { buildArtistRecords, type ArtistRecord } from './records';
import './artists.css';

function AppearanceTrace({ record }: { record: ArtistRecord }) {
  const dates = [...new Set(record.appearances.map(item => item.event.date))].sort();
  const first = Date.parse(dates[0]);
  const span = Math.max(1, Date.parse(dates[dates.length - 1]) - first);
  return <svg className="ta-trace" viewBox="0 0 160 24" aria-hidden="true"><path d="M0 18H160" />{dates.map(date => {
    const x = dates.length === 1 ? 80 : 6 + ((Date.parse(date) - first) / span) * 148;
    return <g key={date}><path d={`M${x} 18V7`} /><circle cx={x} cy="7" r="2" /></g>;
  })}</svg>;
}

function ArtistFile({ record, lang, t, back }: { record: ArtistRecord; back: () => void } & Pick<ScreenProps, 'lang' | 't'>) {
  const log = useRecordWindow(record.appearances.map(item => ({ ...item, id: `${item.event.id}:${item.artist.id}` })), 4, 3, 'performanceFrom');
  const paragraphs = record.appearances.map(item => biography(item.artist, lang)).find(lines => lines.length) ?? [];
  const excerpt = sourceExcerpt(paragraphs, lang, 280);
  return <div className="ta-profile" onKeyDown={event => { if (event.key === 'Escape' && !(event.target instanceof Element && event.target.closest('dialog'))) back(); }}>
    <aside className="ta-profile-data"><h2 className="tm-section-title">ARTIST DATA_</h2><dl className="ta-data">
      <div><dt>{t('출신', 'Origin')}</dt><dd>{record.origin}</dd></div>
      <div><dt>{t('참여 행사', 'Events')}</dt><dd>{String(record.eventCount).padStart(2, '0')}</dd></div>
      <div><dt>{t('출연 기록', 'Appearances')}</dt><dd>{String(record.appearances.length).padStart(2, '0')}</dd></div>
      <div><dt>{t('첫 기록', 'First record')}</dt><dd>{record.firstDate}</dd></div>
      <div><dt>{t('최근 기록', 'Latest record')}</dt><dd>{record.lastDate}</dd></div>
    </dl><section className="ta-activity"><h3 className="tm-section-title">APPEARANCE TIMELINE_</h3><AppearanceTrace record={record} /><div><span>{record.firstDate}</span><span>{record.lastDate}</span></div></section><button type="button" className="tm-button" onClick={back}>{t('명단으로', 'Back to index')}</button></aside>
    <section className="ta-profile-main" aria-labelledby="artist-record-title"><div className="ta-profile-heading"><p className="tm-eyebrow">PUBLIC ARTIST FILE</p><h2 id="artist-record-title" data-view-title data-navigation-arrival="true" tabIndex={-1}>{record.name}</h2><span>{record.origin} / TERMINAL</span></div><div className="ta-profile-notes"><h3 className="tm-section-title">PROFILE NOTES_</h3>{excerpt.map((line, index) => <p key={index}>{line}</p>)}{!paragraphs.length && <p>{t('공개된 소개가 없습니다.', 'No public biography available.')}</p>}{paragraphs.length > 0 && <DocumentReader key={`${record.id}:${lang}`} title={record.name} paragraphs={paragraphs} t={t} />}</div></section>
    <section className="ta-appearances"><h3 className="tm-section-title">PERFORMANCE LOG_</h3><ol>{log.records.map(({ event, artist, id }) => <li key={id}><time dateTime={event.date}>{event.date}</time><Link scroll={false} href={href('gate', event.id)}>{event.session} ↗</Link><p>{event.venue}</p><dl><div><dt>STAGE</dt><dd>{artist.dock}</dd></div><div><dt>SET</dt><dd>{artist.time === 'TBA' ? t('미공개', 'TBA') : artist.time}</dd></div></dl><Link scroll={false} className="tm-text-link" href={href('lineup', event.id, artist.id)}>{t('행사 라인업', 'Event lineup')}</Link></li>)}</ol><RecordControls {...log} count={log.records.length} t={t} /></section>
  </div>;
}

export function ArtistArchive({ events, lang, t }: ScreenProps) {
  const records = buildArtistRecords(events);
  const page = useRecordWindow(records, 8, 4);
  const [artistId, setArtist] = useUrlQueryState('artist');
  const selected = artistId ? records.find(record => record.appearances.some(item => item.artist.id === artistId)) : undefined;
  const region = useRef<HTMLElement>(null);
  const chosen = useRef(false);
  const returnId = useRef<string | null>(null);
  useReadoutMotion(region, { key: `${artistId}:${lang}:${page.offset}`, content: ':scope', layout: true });
  useEffect(() => {
    if (chosen.current) { focusNavigationTarget(document.getElementById('artist-record-title')); chosen.current = false; }
    if (!artistId && returnId.current) { focusNavigationTarget(document.getElementById(`artist-record-${returnId.current}`)); returnId.current = null; }
  }, [artistId]);
  const back = () => { returnId.current = selected?.id ?? null; setArtist('', { performanceFrom: '' }); };
  const appearances = records.reduce((total, record) => total + record.appearances.length, 0);
  if (artistId && !selected) return <section className="tm-empty"><h2 data-view-title tabIndex={-1}>{t('아티스트를 찾을 수 없습니다.', 'Artist not found.')}</h2><button type="button" className="tm-button" onClick={() => setArtist('')}>{t('아티스트 아카이브', 'Artist archive')}</button></section>;
  return <section ref={region} className="ta-archive" data-readout-region>
    {selected ? <ArtistFile key={selected.id} record={selected} lang={lang} t={t} back={back} /> : <>
      <header className="ta-registry-header"><div><p className="tm-eyebrow">CREW / PUBLIC ARTIST REGISTRY</p><h2 data-view-title tabIndex={-1}>{t('아티스트 아카이브', 'Artist archive')}</h2></div><dl><div><dt>ARTISTS</dt><dd>{String(records.length).padStart(2, '0')}</dd></div><div><dt>APPEARANCES</dt><dd>{String(appearances).padStart(2, '0')}</dd></div></dl></header>
      {records.length ? <div className="ta-matrix">{page.records.map(record => <Link scroll={false} id={`artist-record-${record.id}`} className="ta-cell" key={record.id} href={href('artists', undefined, record.id)} aria-label={record.name} onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); chosen.current = true; setArtist(record.id);
      }}><div className="ta-cell-header"><span>ARTIST {String(records.indexOf(record) + 1).padStart(2, '0')}</span><span>{record.origin}</span></div><h3>{record.name}</h3><div className="ta-vital"><span>{t('참여 행사', 'EVENTS')}</span><strong>{String(record.eventCount).padStart(2, '0')}</strong></div><div className="ta-vital"><span>{t('최근 출연', 'LAST RECORD')}</span><span>{record.lastDate}</span></div><AppearanceTrace record={record} /><div className="ta-period"><span>{record.firstDate}</span><span>{record.lastDate}</span></div></Link>)}</div> : <p className="tm-box" role="status">{t('공개된 아티스트 기록이 없습니다.', 'No public artist records.')}</p>}
      <footer className="ta-registry-footer"><div><p>{t('TERMINAL의 공개 아티스트와 행사별 출연 기록.', 'The artists and public performance records of TERMINAL.')}</p><Link scroll={false} className="tm-text-link" href={href('status')}>{t('행사 아카이브', 'Event archive')} ↗</Link></div><RecordControls {...page} count={page.records.length} t={t} /></footer>
    </>}
  </section>;
}
