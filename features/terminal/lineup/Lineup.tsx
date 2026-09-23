'use client';

import Link from 'next/link';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { biography, href, isPublicArtist, type ScreenProps } from '../events/data';
import { EventPicker, NoEvent, PageHeading } from '../shared/Ui';
import { useReadoutMotion } from '../motion/useReadoutMotion';
import { TerminalText } from '../motion/TerminalText';
import { focusNavigationTarget } from '../shell/useNavigationContinuity';
import './lineup.css';

export function Lineup(props: ScreenProps & { artistId: string | null }) {
  const { event, events, artistId, t, lang } = props;
  const [, setArtistId] = useUrlQueryState('artist');
  const shouldFocus = useRef(false);
  const firstProfile = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const profileRef = useRef<HTMLElement>(null);
  const rosterRef = useRef<HTMLDetailsElement>(null);
  useReadoutMotion(profileRef, { key: `${event?.id}:${artistId}:${lang}`, content: ':scope', layout: true });
  useEffect(() => {
    if (shouldFocus.current || (firstProfile.current && artistId)) focusNavigationTarget(headingRef.current);
    shouldFocus.current = false;
    if (event?.id) firstProfile.current = false;
  }, [artistId, event?.id]);
  useLayoutEffect(() => {
    const roster = rosterRef.current;
    if (!roster) return;
    const media = window.matchMedia('(max-width: 760px)');
    let focused = document.activeElement;
    const remember = (e: FocusEvent) => { if (e.target instanceof Element) focused = e.target; };
    const resize = () => {
      roster.open = !media.matches;
      if (media.matches && roster.contains(focused)) roster.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
      else if (!media.matches && focused === roster.querySelector('summary')) headingRef.current?.focus({ preventScroll: true });
    };
    resize();
    document.addEventListener('focusin', remember);
    media.addEventListener('change', resize);
    return () => { media.removeEventListener('change', resize); document.removeEventListener('focusin', remember); };
  }, [event?.id]);
  if (!event) return <NoEvent t={t} invalid={events.length > 0} />;
  const publicArtists = event.artists.filter(isPublicArtist);
  const requested = event.artists.find(artist => artist.id === artistId);
  const selected = artistId ? (requested && isPublicArtist(requested) ? requested : undefined) : publicArtists[0];
  const choose = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (artistId === id) { if (window.matchMedia('(max-width: 760px)').matches && rosterRef.current) rosterRef.current.open = false; focusNavigationTarget(headingRef.current); return; }
    shouldFocus.current = true;
    setArtistId(id, { event: event.id });
    if (window.matchMedia('(max-width: 760px)').matches && rosterRef.current) rosterRef.current.open = false;
  };
  const returnToRoster = () => {
    if (rosterRef.current) rosterRef.current.open = true;
    focusNavigationTarget(document.getElementById(`tm-artist-${selected?.id ?? publicArtists[0]?.id}`) ?? rosterRef.current?.querySelector('summary') ?? null);
  };
  return <>
    <PageHeading code="LINEUP / ARTIST DIRECTORY" title={t('라인업', 'Lineup')}><EventPicker {...props} page="lineup" /></PageHeading>
    <div className="tm-lineup" data-has-profile={Boolean(selected)}>
      <aside className="tm-roster"><details ref={rosterRef} className="tm-roster-disclosure" open><summary className="tm-roster-summary"><span>{t('아티스트 명단', 'Artist list')}</span><span>{selected?.name ?? t('명단 보기', 'View list')}</span></summary><div><div className="tm-cell"><p className="tm-eyebrow">{event.session}</p><p className="tm-roster-date">{event.date} / {event.venue}</p><h2 className="tm-eyebrow">{t('공개된 아티스트', 'PUBLISHED ARTISTS')}</h2></div><ul>{publicArtists.map((artist, index) => <li key={artist.id}><Link scroll={false} id={`tm-artist-${artist.id}`} href={href('lineup', event.id, artist.id)} aria-current={selected?.id === artist.id ? 'true' : undefined} aria-controls="tm-artist-profile" onClick={e => choose(e, artist.id)}><span className="tm-artist-index">{String(index + 1).padStart(2, '0')}</span><span>{artist.name}</span></Link></li>)}</ul>{event.artists.length > publicArtists.length && <p className="tm-roster-unpublished">{t(`그 외 ${event.artists.length - publicArtists.length}개 항목은 아티스트 정보가 공개되지 않았습니다.`, `${event.artists.length - publicArtists.length} other artist records have not been published.`)}</p>}<Link scroll={false} className="tm-roster-event tm-text-link" href={href('gate', event.id)}><span>{t('이벤트 정보', 'Event details')}</span></Link></div></details></aside>
      <section data-readout-region data-navigation-section ref={profileRef} id="tm-artist-profile" className="tm-artist-profile tm-cell" onKeyDown={e => { if (e.key === 'Escape') returnToRoster(); }} aria-labelledby="tm-artist-name">
        {selected ? <><div className="tm-profile-top"><p className="tm-eyebrow">ARTIST / {selected.id}</p><button type="button" className="tm-button tm-roster-return" onClick={returnToRoster}><span>{t('명단으로', 'Back to list')}</span></button></div><h2 id="tm-artist-name" data-navigation-arrival={artistId ? 'true' : undefined} ref={headingRef} tabIndex={-1}><TerminalText>{selected.name}</TerminalText></h2><dl className="tm-artist-data"><div><dt>{t('출신', 'Origin')}</dt><dd>{selected.origin}</dd></div><div><dt>{t('스테이지', 'Stage')}</dt><dd>{selected.dock}</dd></div><div><dt>{t('출연 시간', 'Set time')}</dt><dd>{selected.time === 'TBA' ? t('미공개', 'Not announced') : selected.time}</dd></div></dl><div className="tm-artist-bio tm-prose">{biography(selected, lang).map((line, i) => <p key={i}>{line}</p>)}</div></> : <><h2 id="tm-artist-name" data-navigation-arrival={artistId ? 'true' : undefined} tabIndex={-1} ref={headingRef}><TerminalText>{artistId ? t(requested ? '아티스트 정보 미공개' : '아티스트를 찾을 수 없습니다.', requested ? 'Artist not published' : 'Artist not found.') : t('공개된 아티스트가 없습니다.', 'No published artists.')}</TerminalText></h2><p role="status">{t('공개 명단에서 아티스트를 선택해 주세요.', 'Choose an artist from the published roster.')}</p></>}
      </section>
    </div>
  </>;
}
