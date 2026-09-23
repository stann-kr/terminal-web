'use client';

import Link from 'next/link';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import type { ReactNode } from 'react';
import { href, type Page, type ScreenProps, type Translate } from '../events/data';
import { TerminalText } from '../motion/TerminalText';
import { PendingIndicator } from '../motion/PendingIndicator';
import './ui.css';

export function Action({ page, event, artist, children, secondary = false }: { page: Page; event?: string; artist?: string; children: ReactNode; secondary?: boolean }) {
  return <Link scroll={false} className={`tm-action${secondary ? ' tm-action-secondary' : ''}`} href={href(page, event, artist)}><span>{children}</span></Link>;
}

export function PageHeading({ code, title, children, afterglow = true }: { code: string; title: string; children?: ReactNode; afterglow?: boolean }) {
  return <div className="tm-page-heading"><div><p data-motion-copy className="tm-eyebrow">{code}</p><h1 data-motion-title tabIndex={-1}><TerminalText afterglow={afterglow}>{title}</TerminalText></h1></div>{children}</div>;
}

export function PagePending({ code, t }: { code: string; t: Translate }) {
  return <div className="tm-page-pending" data-readout-region>
    <div className="tm-pending-line" aria-busy="true"><h1 className="tm-eyebrow">{code}</h1><PendingIndicator active /></div>
    <p className="tm-sr-only" role="status">{t('이벤트 정보를 불러오는 중입니다.', 'Loading event information.')}</p>
  </div>;
}

export function EventPicker({ events, event, t }: Pick<ScreenProps, 'event' | 'events' | 't'> & { page: Page }) {
  const [, selectEvent] = useUrlQueryState('event');
  if (events.length < 2) return null;
  return <label className="tm-event-picker"><span>{t('이벤트 선택', 'Select event')}</span><select id="terminal-event-picker" value={event?.id ?? ''} onChange={e => { selectEvent(e.target.value, { artist: '', view: '' }); }}>{!event && <option value="" disabled>{t('이벤트를 선택해 주세요', 'Choose an event')}</option>}{events.map(item => <option key={item.id} value={item.id}>{item.session} · {item.date}</option>)}</select><span className="tm-select-arrow" aria-hidden="true">⌄</span></label>;
}

export function NoEvent({ t, invalid = false }: { t: Translate; invalid?: boolean }) {
  return <section className="tm-empty"><p className="tm-eyebrow">GATE / {invalid ? 'NOT FOUND' : 'NO EVENTS'}</p><h1 data-motion-title tabIndex={-1}><TerminalText>{invalid ? t('이벤트를 찾을 수 없습니다.', 'Event not found.') : t('공개된 이벤트가 없습니다.', 'No published events.')}</TerminalText></h1><div className="tm-action-group"><Action page="signal">{t('이벤트 소식 받기', 'Get event updates')}</Action><Action page="link" secondary>{t('공식 채널', 'Official channels')}</Action></div></section>;
}

export function EventState({ event, t }: Pick<ScreenProps, 'event' | 't'>) {
  if (!event) return null;
  return <span className="tm-state">{event.status === 'ARCHIVED' ? t('지난 이벤트', 'PAST EVENT') : event.status === 'LIVE' ? t('진행 중', 'LIVE') : t('예정된 이벤트', 'UPCOMING')}</span>;
}
