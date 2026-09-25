/* eslint-disable @next/next/no-img-element -- Posters retain their source aspect ratio without invented dimensions. */
'use client';
import Link from 'next/link';
import type { Artist, TerminalEvent } from '@/lib/events/types';
import { useLanguage } from '@/features/shell/Providers';
import { Action, Facts, FullText, Panel, ui } from '@/features/ui/Ui';
import { buildArtistArchive, profileForAppearance, artistHref } from '@/features/artists/model';
import { accessAvailability, eventHref, paragraphs, publicArtists, statusLabel } from './model';
import styles from './events.module.css';

export function EventFacts({ event, modular = false }: { event: TerminalEvent; modular?: boolean }) {
  const groups = [
    { label: 'DATE / TIME', rows: [['날짜', event.date], ['시작 / KST', event.time.replace(' KST','')]] },
    { label: 'VENUE', rows: [['장소', event.venue], ['지역', event.district], ['좌표', event.coords]] },
  ];
  if (modular) return <div className={styles.factModules}>{groups.map(group => <div key={group.label} className={styles.factModule}><p data-readout-row="" lang="en">{group.label}</p><Facts rows={group.rows.map(([label,value]) => [label,value])}/></div>)}</div>;
  return <Facts rows={[["일시 / KST", `${event.date} · ${event.time.replace(' KST','')}`],["장소", event.venue],["지역",event.district],["좌표",event.coords]]}/>;
}
export function EventActions({ event, events, now }: { event: TerminalEvent; events: TerminalEvent[]; now: Date }) {
  const access = accessAvailability(event,events,now);
  return <div className={styles.accessProtocol} data-open={access.canRequest}>
    <p data-open={access.canRequest} className={styles.protocolLabel} lang="en">{access.canRequest ? 'ACCESS OPEN' : event.status === 'ARCHIVED' ? 'ARCHIVE RECORD' : 'ACCESS INFO'}</p>
    <p className={ui.muted}>{access.message}</p>
    {access.canRequest && <Action primary href={`${eventHref(event.id)}/request`}>게스트 신청</Action>}
    <Action href="/signal">다음 행사 소식 신청</Action>
  </div>;
}
export function Lineup({ event, events, stages = false }: { event: TerminalEvent; events: TerminalEvent[]; stages?: boolean }) {
  const profiles = buildArtistArchive(events);
  const visible = publicArtists(event);
  function identity(artist: Artist) {
    const profile = profileForAppearance(profiles,event.id,artist.id);
    return <>{profile ? <Link href={artistHref(profile.key)}>{artist.name}</Link> : artist.name}<small>{artist.origin}</small></>;
  }
  if (!visible.length) return null;
  return <>
    {stages ? <div className={styles.stageBoard}>
      {[...new Set(visible.map(artist => artist.dock || 'TBA'))].map(dock => <section className={styles.stage} key={dock} aria-label={`무대 ${dock}`}>
        <h3 data-readout-row=""><span>STAGE {dock}</span><span>공개 공연표</span></h3>
        <ul className={styles.stageSlots}>{visible.filter(artist => (artist.dock || 'TBA') === dock).map(artist => <li key={artist.id}>
          <div data-readout-row="" className={styles.slotCode}>{artist.id}<span>{artist.status === 'ARCHIVED' ? 'ARCHIVE' : 'CONFIRMED'}</span></div>
          <div className={styles.slotArtist}>{identity(artist)}</div><p data-readout-row="" className={styles.slotTime}><span>TIME</span>{artist.time}</p>
        </li>)}</ul>
      </section>)}
    </div> : <ul className={styles.lineup}>{visible.map(artist => <li key={artist.id}><span className={styles.dock}>{artist.dock}</span><div>{identity(artist)}</div><time>{artist.time}</time></li>)}</ul>}
  </>;
}
export function EventRecord({ event, events, now, compact = false }: { event: TerminalEvent; events: TerminalEvent[]; now: Date; compact?: boolean }) {
  const { language } = useLanguage();
  return <div className={compact ? styles.recordCompact : styles.record}>
    <Panel title={event.session} code={event.id}><p className={ui.muted}>{event.subtitle}</p><div data-event-state={event.status} className={styles.status}>{statusLabel(event.status)}</div><EventFacts event={event} modular/>{event.posterUrl && <a className={styles.poster} href={event.posterUrl} target="_blank" rel="noopener noreferrer"><img src={event.posterUrl} alt={`${event.session} 행사 포스터 — 새 탭에서 확대`}/></a>}<div className={ui.actions}><Action href="/events">이벤트 목록</Action></div></Panel>
    <Panel title="공연표" code="RUNNING ORDER" className={styles.runningOrder}><Lineup event={event} events={events} stages/><div className={styles.stagePreview} aria-hidden="true" data-active={event.status !== 'ARCHIVED'}>{Array.from({length:16},(_,index) => <i key={index} data-lit={[0,3,4,7,8,9,12,15].includes(index)} data-blink={index === 8 || index === 9}/>)}</div></Panel>
    <div className={ui.stack}><Panel title="행사 소개" code={language.toUpperCase()}><div className={styles.annotation}><FullText language={language} paragraphs={paragraphs(event.description,language)}/>{paragraphs(event.invitationLines,language).length > 0 && <details><summary>초대 안내 전체 읽기</summary><FullText language={language} excerpt={false} paragraphs={paragraphs(event.invitationLines,language)}/></details>}</div></Panel><Panel title="참여 안내"><EventActions event={event} events={events} now={now}/><div className={styles.recordRule} aria-hidden="true"/></Panel></div>
  </div>;
}
