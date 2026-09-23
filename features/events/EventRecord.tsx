/* eslint-disable @next/next/no-img-element -- Posters retain their source aspect ratio without invented dimensions. */
'use client';
import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { useLanguage } from '@/features/shell/Providers';
import { Action, Facts, FullText, Panel, ui } from '@/features/ui/Ui';
import { buildArtistArchive, profileForAppearance, artistHref } from '@/features/artists/model';
import { accessAvailability, eventHref, paragraphs, publicArtists, statusLabel } from './model';
import styles from './events.module.css';

export function EventFacts({ event }: { event: TerminalEvent }) {
  return <Facts rows={[["일시 / KST", `${event.date} · ${event.time.replace(' KST','')}`],["장소", event.venue],["지역",event.district],["좌표",event.coords],["사운드",event.sound],["수용 규모",event.capacity]]} />;
}
export function EventActions({ event, events, now }: { event: TerminalEvent; events: TerminalEvent[]; now: Date }) {
  const access = accessAvailability(event,events,now);
  return <div className={ui.stack}><p className={ui.muted}>{access.message}</p>{access.canRequest && <Action primary href={`${eventHref(event.id)}/request`}>게스트 신청</Action>}<Action href="/signal">다음 행사 소식 신청</Action><p className={ui.muted}>게스트 신청은 접수 기록입니다. 입장 확정이나 티켓 발급을 의미하지 않습니다.</p></div>;
}
export function Lineup({ event, events }: { event: TerminalEvent; events: TerminalEvent[] }) {
  const profiles = buildArtistArchive(events);
  const visible = publicArtists(event);
  const hidden = event.artists.length - visible.length;
  return <><ul className={styles.lineup}>{visible.map(artist => {
    const profile = profileForAppearance(profiles,event.id,artist.id);
    return <li key={artist.id}><span className={styles.dock}>{artist.dock}</span><div>{profile ? <Link href={artistHref(profile.key)}>{artist.name} ↗</Link> : artist.name}<small>{artist.origin}</small></div><time>{artist.time}</time></li>;
  })}</ul>{hidden > 0 && <p className={styles.hidden}>추가 공개 예정 {hidden}팀</p>}{!event.artists.length && <p className={ui.muted}>공연표는 추후 공개됩니다.</p>}</>;
}
export function EventRecord({ event, events, now, compact = false }: { event: TerminalEvent; events: TerminalEvent[]; now: Date; compact?: boolean }) {
  const { language } = useLanguage();
  return <div className={compact ? styles.recordCompact : styles.record}>
    <Panel title="행사 정보" code={event.id}><div className={styles.status}>{statusLabel(event.status)}</div><EventFacts event={event}/>{event.posterUrl && <a className={styles.poster} href={event.posterUrl} target="_blank" rel="noopener noreferrer"><img src={event.posterUrl} alt={`${event.session} 행사 포스터 — 새 탭에서 확대`} /></a>}</Panel>
    <Panel title="공연표" code="RUNNING ORDER"><Lineup event={event} events={events}/><p className={styles.note}>공연 시간은 공개된 원문 기준입니다. TBA는 추후 안내됩니다.</p></Panel>
    <div className={ui.stack}><Panel title="행사 소개" code={language.toUpperCase()}><FullText language={language} paragraphs={paragraphs(event.description,language)} />{paragraphs(event.invitationLines,language).length > 0 && <details><summary>초대 안내 전체 읽기</summary><FullText language={language} excerpt={false} paragraphs={paragraphs(event.invitationLines,language)}/></details>}</Panel><Panel title="참여 안내"><EventActions event={event} events={events} now={now}/></Panel></div>
  </div>;
}
