'use client';

/* eslint-disable @next/next/no-img-element -- Public event posters use the original image URL and retain the typography fallback. */
import Link from 'next/link';
import { useState } from 'react';
import { getRequestWindowState, getFutureUpcomingEvent } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import { Action, EventPicker, EventState, NoEvent, PageHeading } from '../shared/Ui';
import { href, isPublicArtist, type ScreenProps } from './data';
import { TerminalText } from '../motion/TerminalText';
import { EventCountdown } from './EventCountdown';
import './events.css';

function requestAvailable({ event, events, now }: Pick<ScreenProps, 'event' | 'events' | 'now'>) {
  return Boolean(event && event.id === getFutureUpcomingEvent(events, now)?.id && getRequestWindowState(event, ACCESS_WINDOW_DAYS, now).isActive);
}

export function Home(props: ScreenProps & { poster: string }) {
  const { event, t, lang, poster } = props;
  const [failedPoster, setFailedPoster] = useState('');
  if (!event) return <NoEvent t={t} />;
  const showPoster = Boolean(poster && poster !== failedPoster);
  const session = event.session.match(/\[([^\]]+)\]/)?.[0] ?? event.id;
  const title = event.session.replace(/\s*\[[^\]]+\]/, '');
  const introduction = event.description?.[lang].split('\n\n')[0];
  const canRequest = requestAvailable(props);
  const artists = event.artists.filter(isPublicArtist);
  return <article className="tm-home" data-poster={showPoster}>
    <header className="tm-home-title">
      <div className="tm-home-meta"><p className="tm-eyebrow">CURRENT EVENT / {event.id}</p><EventState event={event} t={t} /></div>
      <h1 data-motion-title tabIndex={-1}><TerminalText afterglow>{title}</TerminalText>{title !== event.session && <span className="tm-home-session">{session}</span>}</h1>
      <p className="tm-eyebrow">SEOUL / TECHNO</p>
    </header>
    <section className="tm-home-data tm-cell" aria-labelledby="home-data-title">
      <h2 id="home-data-title" className="tm-section-title">EVENT DATA_</h2>
      <dl className="tm-home-facts">
        <div data-motion-copy><dt>{t('일시', 'Date / time')}</dt><dd><time dateTime={`${event.date}T${event.time.slice(0, 5)}:00+09:00`}>{event.date}</time><span>{event.time}</span></dd></div>
        <div data-motion-copy><dt>{t('장소', 'Venue')}</dt><dd>{event.venue}<span className="tm-home-district">{event.district}</span></dd></div>
        {event.sound && <div data-motion-copy><dt>{t('사운드', 'Sound')}</dt><dd>{event.sound}</dd></div>}
      </dl>
      <p className="tm-home-reference">{event.id}<br />STANN OS / LIVE</p>
    </section>
    <section className="tm-home-actions tm-cell" aria-labelledby="home-access-title">
      <h2 id="home-access-title" className="tm-section-title">PARTICIPATE_</h2>
      <p data-motion-copy className="tm-home-request-state" data-open={canRequest}>{canRequest ? t('게스트 신청 가능', 'Guest requests open') : event.status === 'ARCHIVED' || event.status === 'LIVE' ? t('온라인 신청 마감', 'Online requests closed') : t('현재 온라인 신청 기간이 아닙니다.', 'Online requests are not open.')}</p>
      {canRequest && <Action page="request" event={event.id}>{t('게스트 신청', 'Guest request')}</Action>}
      <Action page="gate" event={event.id} secondary={canRequest}>{event.status === 'ARCHIVED' ? t('아카이브 보기', 'View archive') : t('이벤트 보기', 'View event')}</Action>
      <Link scroll={false} className="tm-text-link" href={href('signal')}><span>{t('다음 이벤트 소식 받기', 'Get future event updates')}</span></Link>
    </section>
    <figure className="tm-home-visual">
      {showPoster ? <img src={poster} alt={`${event.session} ${t('포스터', 'poster')}`} onError={() => setFailedPoster(poster)} /> : <div className="tm-orbital" aria-hidden="true">
        <svg viewBox="0 0 200 200" fill="none"><g className="tm-orbit-primary"><ellipse cx="100" cy="100" rx="90" ry="30" transform="rotate(-15 100 100)" /><ellipse cx="100" cy="100" rx="90" ry="30" transform="rotate(15 100 100)" /></g><g className="tm-orbit-secondary"><ellipse cx="100" cy="100" rx="60" ry="20" transform="rotate(45 100 100)" /></g><path d="M100 85v30M85 100h30" /><circle cx="100" cy="100" r="2" fill="currentColor" /></svg>
        <span>{session}</span>
      </div>}
      <figcaption><span>{showPoster ? 'EVENT ARTWORK' : 'TERMINAL / LIVE'}</span><span>{event.id}</span></figcaption>
    </figure>
    <EventCountdown key={event.id} event={event} t={t} />
    <section className="tm-home-intro tm-cell" aria-labelledby="home-intro-title"><h2 id="home-intro-title" className="tm-section-title">EVENT NOTES_</h2><h3 data-motion-copy>{event.subtitle}</h3>{introduction && <p data-motion-copy>{introduction}</p>}</section>
    <section className="tm-home-lineup tm-cell" aria-labelledby="home-lineup-title"><h2 id="home-lineup-title" className="tm-section-title">LINEUP_</h2>
      {artists.length ? <ul>{artists.slice(0, 6).map((artist, index) => <li key={artist.id}><Link scroll={false} href={href('lineup', event.id, artist.id)}><span className="tm-eyebrow">{String(index + 1).padStart(2, '0')}</span><span>{artist.name}</span></Link><p>{artist.time === 'TBA' ? t('시간 미공개', 'Time TBA') : artist.time}</p></li>)}</ul> : <p>{t('라인업 공개 예정', 'Lineup to be announced')}</p>}
      <Action page="lineup" event={event.id} secondary>{t('라인업 보기', 'Explore lineup')}</Action>
    </section>
  </article>;
}

export function Gate(props: ScreenProps & { poster: string }) {
  const { event, events, t, lang } = props;
  const [failedPoster, setFailedPoster] = useState('');
  if (!event) return <NoEvent t={t} invalid={events.length > 0} />;
  const publicArtists = event.artists.filter(isPublicArtist);
  const canRequest = requestAvailable(props);
  const details = [[t('일시', 'Date'), `${event.date} / ${event.time}`], [t('장소', 'Venue'), event.venue]];
  const context = [[t('지역', 'District'), event.district], [t('위치', 'Coordinates'), event.coords], [t('정원', 'Capacity'), event.capacity.includes('CLASSIFIED') ? '' : event.capacity], [t('사운드', 'Sound'), event.sound]].filter(([, value]) => value);
  const facts = (rows: string[][]) => <dl>{rows.map(([label, value]) => <div data-motion-copy key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
  return <>
    <PageHeading code="GATE / EVENT FILE" title={event.session}><EventPicker {...props} page="gate" /></PageHeading>
    <section className="tm-gate-summary tm-cell" aria-label={t('일정과 신청', 'Schedule and requests')}>
      <div className="tm-gate-details"><EventState event={event} t={t} />{facts(details)}</div>
      <div className="tm-gate-next">{canRequest ? <Action page="request" event={event.id}>{t('게스트 신청', 'Guest request')}</Action> : <p>{event.status === 'ARCHIVED' || event.status === 'LIVE' ? t('이 이벤트의 온라인 신청은 마감되었습니다.', 'Online requests for this event are closed.') : t('현재 온라인 신청 기간이 아닙니다.', 'Online requests are not open.')}</p>}<Action page="lineup" event={event.id} secondary>{t('라인업 보기', 'Explore lineup')}</Action></div>
    </section>
    <div className="tm-gate-grid">
      <section className="tm-gate-copy tm-cell"><p className="tm-eyebrow">{event.id} / EVENT FILE</p><h2 data-motion-title><TerminalText>{event.subtitle}</TerminalText></h2><div className="tm-prose">{event.description?.[lang].split('\n\n').map((text, i) => <p data-motion-copy key={i}>{text}</p>)}</div>{props.poster && props.poster !== failedPoster && <img className="tm-gate-poster" src={props.poster} alt={`${event.session} ${t('포스터', 'poster')}`} onError={() => setFailedPoster(props.poster)} />}</section>
      <div className="tm-gate-context"><section className="tm-gate-lineup tm-cell"><h2 className="tm-eyebrow">LINEUP</h2><ul>{publicArtists.map(artist => <li key={artist.id}><Link scroll={false} href={href('lineup', event.id, artist.id)}><span>{artist.name}</span></Link><p data-motion-copy>{artist.time === 'TBA' ? t('시간 미공개', 'Set time not announced') : artist.time}</p></li>)}</ul>{event.artists.length > publicArtists.length && <p className="tm-gate-note">{t(`그 외 ${event.artists.length - publicArtists.length}개 항목은 아티스트 정보 미공개`, `${event.artists.length - publicArtists.length} other artist records are unpublished`)}</p>}</section><section className="tm-gate-details tm-cell"><h2 className="tm-eyebrow">{t('장소 정보', 'VENUE INFO')}</h2>{facts(context)}</section></div>
    </div>
  </>;
}
