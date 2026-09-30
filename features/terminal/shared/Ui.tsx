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

export function PageHeading({ code, title, children, afterglow = false }: { code: string; title: string; children?: ReactNode; afterglow?: boolean }) {
  return <div className="tm-page-heading"><div><p data-motion-copy className="tm-eyebrow">{code}</p><h2 data-view-title data-motion-title tabIndex={-1}><TerminalText afterglow={afterglow}>{title}</TerminalText></h2></div>{children}</div>;
}

export function PagePending({ code, t }: { code: string; t: Translate }) {
  return <div className="tm-page-pending" data-readout-region>
    <div className="tm-pending-line" aria-busy="true"><span className="tm-eyebrow">{code}</span><PendingIndicator active /></div>
    <p className="tm-sr-only" role="status">{t('이벤트 정보를 불러오는 중입니다.', 'Loading event information.')}</p>
  </div>;
}

export function EventPicker({ events, event, t }: Pick<ScreenProps, 'event' | 'events' | 't'> & { page: Page }) {
  const [, selectEvent] = useUrlQueryState('event');
  if (events.length < 2) return null;
  return <label className="tm-event-picker"><span>{t('이벤트 선택', 'Select event')}</span><select id="terminal-event-picker" value={event?.id ?? ''} onChange={e => { selectEvent(e.target.value, { artist: '', view: '', from: '' }); }}>{!event && <option value="" disabled>{t('이벤트를 선택해 주세요', 'Choose an event')}</option>}{events.map(item => <option key={item.id} value={item.id}>{item.session} · {item.date}</option>)}</select><span className="tm-select-arrow" aria-hidden="true">⌄</span></label>;
}

export function NoEvent({ t, invalid = false }: { t: Translate; invalid?: boolean }) {
  return <section className="tm-empty"><p className="tm-eyebrow">GATE / {invalid ? 'NOT FOUND' : 'NO EVENTS'}</p><h2 data-view-title data-motion-title tabIndex={-1}><TerminalText>{invalid ? t('이벤트를 찾을 수 없습니다.', 'Event not found.') : t('공개된 이벤트가 없습니다.', 'No published events.')}</TerminalText></h2><div className="tm-action-group"><Action page="signal">{t('이벤트 소식 받기', 'Get event updates')}</Action><Action page="link" secondary>{t('공식 채널', 'Official channels')}</Action></div></section>;
}

export function EventState({ event, t }: Pick<ScreenProps, 'event' | 't'>) {
  if (!event) return null;
  return <span className="tm-state" data-state={event.status}>{event.status === 'ARCHIVED' ? t('지난 이벤트', 'PAST EVENT') : event.status === 'LIVE' ? t('진행 중', 'LIVE') : t('예정된 이벤트', 'UPCOMING')}</span>;
}

export function RecordControls({ offset, count, total, previous, next, hasPrevious, hasNext, t }: { offset: number; count: number; total: number; previous: () => void; next: () => void; hasPrevious: boolean; hasNext: boolean; t: Translate }) {
  if (!hasPrevious && !hasNext) return null;
  return <nav className="tm-record-controls" aria-label={t('목록 페이지', 'List pages')}><button className="tm-button" type="button" disabled={!hasPrevious} onClick={previous}>{t('이전', 'Previous')}</button><span aria-live="polite">{offset + 1}–{offset + count} / {total}</span><button className="tm-button" type="button" disabled={!hasNext} onClick={next}>{t('다음', 'Next')}</button></nav>;
}
