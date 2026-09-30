'use client';

/* eslint-disable @next/next/no-img-element -- Event artwork retains its public source URL. */
import Link from 'next/link';
import { useState } from 'react';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { buildArtistRecords } from '../artists/records';
import { DocumentReader } from '../shared/DocumentReader';
import { Action, EventPicker, EventState, NoEvent, PageHeading, RecordControls } from '../shared/Ui';
import { useRecordWindow } from '../shared/useRecordWindow';
import { href, isPublicArtist, type ScreenProps } from './data';
import { requestAvailable, sourceExcerpt } from './presentation';
import { EventCountdown } from './EventCountdown';
import './events.css';

export function Home(props: ScreenProps & { poster: string }) {
  const { event, events, lang, t } = props;
  if (!event) return <NoEvent t={t} />;
  const records = buildArtistRecords(events);
  const appearances = records.reduce((sum, artist) => sum + artist.appearances.length, 0);
  const archived = events.filter(item => item.status === 'ARCHIVED');
  const recent = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const canRequest = requestAvailable(props);
  const paragraphs = event.description?.[lang].split(/\n\s*\n/).filter(Boolean) ?? [];
  return <article className="tm-overview">
    <aside className="tm-overview-registry tm-panel">
      <section><h2 className="tm-section-title">EVENT REGISTRY_</h2><dl className="tm-registry-totals">
        <div><dt>{t('공개 행사', 'Events')}</dt><dd>{String(events.length).padStart(2, '0')}</dd></div>
        <div><dt>{t('지난 행사', 'Archived')}</dt><dd>{String(archived.length).padStart(2, '0')}</dd></div>
        <div><dt>{t('출연 기록', 'Appearances')}</dt><dd>{String(appearances).padStart(2, '0')}</dd></div>
      </dl></section>
      <section><h2 className="tm-section-title">ARTIST INDEX_</h2><div className="tm-overview-artists">{records.slice(0, 4).map(record => <Link scroll={false} href={href('artists', undefined, record.id)} key={record.id}><strong>{record.name}</strong><span>{record.origin} / {String(record.eventCount).padStart(2, '0')} {t('회', 'EVENTS')}</span></Link>)}</div><Link scroll={false} className="tm-text-link" href={href('artists')}>{t(`전체 아티스트 ${records.length}명`, `All ${records.length} artists`)} ↗</Link></section>
      <div className="tm-overview-location"><span>BASED IN SEOUL</span><strong>TERMINAL</strong><span>TECHNO / SOUND / PEOPLE</span></div>
    </aside>
    <section className="tm-overview-file" aria-labelledby="overview-title">
      <div className="tm-overview-file-top"><span>{event.status === 'ARCHIVED' ? 'LATEST EVENT RECORD' : event.status === 'LIVE' ? 'LIVE SESSION' : 'NEXT SESSION'}</span><EventState event={event} t={t} /></div>
      <div className="tm-event-designation"><p>{event.session}</p><h2 id="overview-title" data-view-title data-motion-title tabIndex={-1}>{event.subtitle || event.session}</h2></div>
      <dl className="tm-event-coordinates"><div><dt>DATE / KST</dt><dd><time dateTime={event.date}>{event.date.replaceAll('-', '.')}</time><span>{event.time}</span></dd></div><div><dt>DESTINATION</dt><dd>{event.venue}<span>{event.district}</span></dd></div></dl>
      <div className="tm-overview-notes"><h3 className="tm-section-title">SESSION NOTES_</h3>{sourceExcerpt(paragraphs, lang, 160).map((line, index) => <p key={index}>{line}</p>)}{paragraphs.length > 0 && <DocumentReader key={`${event.id}:${lang}`} title={event.subtitle || event.session} paragraphs={paragraphs} t={t} />}</div>
      {event.status === 'UPCOMING' && <EventCountdown event={event} t={t} />}
      <Action page="gate" event={event.id}>{event.status === 'ARCHIVED' ? t('행사 기록 열기', 'Open event record') : t('행사 정보 열기', 'Open event file')}</Action>
    </section>
    <aside className="tm-overview-comms tm-panel">
      <section><h2 className="tm-section-title">ACCESS STATUS_</h2><div className="tm-access-monitor" data-open={canRequest}><span>{event.id}</span><strong>{canRequest ? 'OPEN' : event.status === 'ARCHIVED' ? 'ARCHIVED' : event.status === 'LIVE' ? 'LIVE' : 'STANDBY'}</strong><p>{canRequest ? t('게스트 신청을 접수 중입니다.', 'Guest requests are open.') : event.status === 'ARCHIVED' ? t('종료된 행사의 기록을 열람할 수 있습니다.', 'This event is preserved in the archive.') : t('현재 온라인 신청 기간이 아닙니다.', 'Online guest requests are closed.')}</p>{canRequest && <Action page="request" event={event.id}>{t('게스트 신청', 'Guest request')}</Action>}</div></section>
      <section className="tm-overview-log"><h2 className="tm-section-title">EVENT LOG_</h2><ol>{recent.map(item => <li key={item.id}><time dateTime={item.date}>{item.date}</time><Link scroll={false} href={href('gate', item.id)}>{item.session}</Link><span>{item.venue}</span></li>)}</ol><Link scroll={false} className="tm-text-link" href={href('status')}>{t('행사 아카이브', 'Event archive')} ↗</Link></section>
      <div className="tm-overview-links"><Action page="signal" secondary>{t('다음 이벤트 소식 받기', 'Get event updates')}</Action><Link scroll={false} className="tm-text-link" href={href('transmit')}>{t('통신 기록 · 방명록', 'Communications / guestbook')} ↗</Link></div>
    </aside>
  </article>;
}

export function Gate(props: ScreenProps & { poster: string }) {
  const { event, events, t, lang } = props;
  const [failedPoster, setFailedPoster] = useState('');
  const [, selectEvent] = useUrlQueryState('event');
  const index = useRecordWindow(events, 4, 2);
  const lineup = useRecordWindow(event?.artists.filter(isPublicArtist) ?? [], 5, 3, 'lineupFrom');
  if (!event) return <NoEvent t={t} invalid={events.length > 0} />;
  const canRequest = requestAvailable(props);
  const paragraphs = event.description?.[lang].split(/\n\s*\n/).filter(Boolean) ?? [];
  const publicArtists = event.artists.filter(isPublicArtist);
  const artwork = Boolean(props.poster && props.poster !== failedPoster);
  return <>
    <PageHeading code={`EVENT FILE / ${event.id}`} title={event.session}><EventPicker {...props} page="gate" /></PageHeading>
    <div className="tm-event-file">
      <aside className="tm-event-file-index tm-panel">
        <section><h2 className="tm-section-title">EVENT INDEX_</h2><nav aria-label={t('행사 목록', 'Event index')} className="tm-event-index">{index.records.map(item => <Link scroll={false} href={href('gate', item.id)} key={item.id} aria-current={item.id === event.id ? 'true' : undefined} onClick={e => {
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          if (item.id !== event.id) selectEvent(item.id, { artist: '', view: '', lineupFrom: '' });
        }}><span>{item.id} / {item.date}</span><strong>{item.subtitle || item.session}</strong><EventState event={item} t={t} /></Link>)}</nav><RecordControls {...index} count={index.records.length} t={t} /></section>
        <section><h2 className="tm-section-title">VENUE DATA_</h2><dl className="tm-file-facts">{[[t('장소', 'Venue'), event.venue], [t('지역', 'District'), event.district], [t('좌표', 'Coordinates'), event.coords], [t('사운드', 'Sound'), event.sound], [t('정원', 'Capacity'), event.capacity.includes('CLASSIFIED') ? '' : event.capacity]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      </aside>
      <section className="tm-event-document" aria-labelledby="event-document-title">
        <div className="tm-event-document-heading"><span className="tm-eyebrow">SESSION / {event.id}</span><h3 id="event-document-title" data-motion-title>{event.subtitle || event.session}</h3><p><time dateTime={event.date}>{event.date}</time> / {event.time}</p></div>
        {artwork && <figure className="tm-event-artwork"><img src={props.poster} alt={`${event.session} ${t('포스터', 'poster')}`} onError={() => setFailedPoster(props.poster)} /><figcaption>{event.id} / EVENT ARTWORK</figcaption></figure>}
        <div className="tm-event-brief"><h3 className="tm-section-title">SESSION NOTES_</h3>{sourceExcerpt(paragraphs, lang, artwork ? 140 : 300).map((text, i) => <p key={i}>{text}</p>)}{!paragraphs.length && <p>{t('공개된 행사 소개가 없습니다.', 'No event notes have been published.')}</p>}{paragraphs.length > 0 && <DocumentReader key={`${event.id}:${lang}`} title={event.subtitle || event.session} paragraphs={paragraphs} t={t} />}</div>
      </section>
      <aside className="tm-event-manifest tm-panel">
        <section><h2 className="tm-section-title">PERFORMANCE MANIFEST_</h2><div className="tm-set-list">{lineup.records.map(artist => <Link scroll={false} href={href('lineup', event.id, artist.id)} key={artist.id}><div><strong>{artist.name}</strong><span>{artist.origin}</span></div><div><span>STAGE {artist.dock}</span><span>{artist.time === 'TBA' ? t('시간 미공개', 'Time TBA') : artist.time}</span></div></Link>)}</div>{!publicArtists.length && <p>{t('라인업 공개 예정', 'Lineup to be announced')}</p>}<RecordControls {...lineup} count={lineup.records.length} t={t} />{event.artists.length > publicArtists.length && <p className="tm-file-note">{t(`미공개 출연 기록 ${event.artists.length - publicArtists.length}건`, `${event.artists.length - publicArtists.length} unpublished appearances`)}</p>}<Link scroll={false} className="tm-text-link" href={href('lineup', event.id)}>{t('라인업 보기', 'Explore lineup')} ↗</Link></section>
        <section className="tm-event-access"><h2 className="tm-section-title">ENTRY PROTOCOL_</h2><EventState event={event} t={t} />{canRequest ? <Action page="request" event={event.id}>{t('게스트 신청', 'Guest request')}</Action> : <><p>{t('이 이벤트의 온라인 신청은 현재 마감되어 있습니다.', 'Online requests for this event are currently closed.')}</p><Action page="signal" secondary>{t('다음 이벤트 소식 받기', 'Get future event updates')}</Action></>}</section>
      </aside>
    </div>
  </>;
}
