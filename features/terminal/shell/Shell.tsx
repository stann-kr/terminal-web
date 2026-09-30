'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { href, pagePaths, type Lang, type Page, type Translate } from '../events/data';
import { useMotionEnabled } from '../motion/MotionProvider';
import { useReadoutMotion } from '../motion/useReadoutMotion';
import { CrtSurface } from '../motion/CrtSurface';
import { useNavigationContinuity } from './useNavigationContinuity';
import '../motion/motion.css';
import './shell.css';

const modules = [
  { page: 'home', code: 'OVERVIEW', ko: '홈', en: 'Overview', group: 'events' },
  { page: 'gate', code: 'EVENT FILE', ko: '행사 정보', en: 'Event details', group: 'events' },
  { page: 'lineup', code: 'LINEUP', ko: '라인업', en: 'Lineup', group: 'events' },
  { page: 'status', code: 'EVENT ARCHIVE', ko: '행사 아카이브', en: 'Event archive', group: 'archive' },
  { page: 'artists', code: 'ARTIST ARCHIVE', ko: '아티스트 아카이브', en: 'Artist archive', group: 'archive' },
  { page: 'transmit', code: 'TRANSMIT', ko: '방명록', en: 'Guestbook', group: 'comms' },
  { page: 'signal', code: 'SIGNAL', ko: '소식 받기', en: 'Updates', group: 'comms' },
  { page: 'link', code: 'CHANNELS', ko: '공식 채널', en: 'Channels', group: 'comms' },
  { page: 'about', code: 'ABOUT', ko: '터미널 소개', en: 'About TERMINAL', group: 'about' },
  { page: 'entry', code: 'ENTER', ko: '터미널 체험', en: 'Terminal experience', group: 'about' },
] satisfies { page: Page; code: string; ko: string; en: string; group: string }[];
const groups = [
  { id: 'events', page: 'gate', code: 'EVENTS', ko: '이벤트', en: 'Events' },
  { id: 'archive', page: 'artists', code: 'ARCHIVE', ko: '아카이브', en: 'Archive' },
  { id: 'comms', page: 'transmit', code: 'COMMS', ko: '소통', en: 'Communications' },
  { id: 'about', page: 'about', code: 'ABOUT', ko: '소개', en: 'About' },
] satisfies { id: string; page: Page; code: string; ko: string; en: string }[];

export function Shell({ page, eventId, designation, eventStatus, viewKey, pathname, ready, motionKey, lang, t, setLang, crt, toggleCrt, children }: {
  page: Page; eventId?: string; designation?: string; eventStatus?: string; viewKey: string; pathname: string; ready: boolean; motionKey: string;
  lang: Lang; t: Translate; setLang: (lang: Lang) => void; crt: boolean; toggleCrt: () => void; children: ReactNode;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const menu = openFor === viewKey;
  const menuRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const extraRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const enabled = useMotionEnabled();
  const entry = page === 'entry';
  const currentGroup = page === 'request' ? 'events' : modules.find(item => item.page === page)?.group ?? 'events';
  const code = page === 'home' ? eventStatus === 'ARCHIVED' ? 'EVENT RECORD' : eventStatus === 'LIVE' ? 'LIVE SESSION' : 'EVENT OVERVIEW' : page === 'request' ? 'GUEST REQUEST' : modules.find(item => item.page === page)?.code ?? 'TERMINAL';
  useNavigationContinuity(mainRef, pathname, ready);
  useReadoutMotion(mainRef, { key: motionKey, active: !entry, content: '[data-active=true]', layout: true });
  useReadoutMotion(headerRef, { key: `${entry}:${lang}:${code}`, active: !entry, controls: '.tm-topline' });
  useReadoutMotion(extraRef, { key: `${menu}:${page}`, active: menu && !entry, content: 'a > span:not(.tm-nav-code)' });
  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpenFor(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('focusin', closeOutside); };
  }, [menu]);
  return <div className="tm-shell" data-page={page} data-crt={crt} data-motion={enabled} data-entry={entry}>
    <a hidden={entry} className="tm-skip" href="#main-content" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>{t('본문으로 건너뛰기', 'Skip to content')}</a>
    <aside className="tm-stub tm-stub-left" hidden={entry} aria-hidden="true"><span>STANN OS / LIVE</span><strong>TERMINAL</strong><span>SEOUL / KR</span></aside>
    <header ref={headerRef} hidden={entry} className="tm-header" onKeyDown={e => { if (e.key === 'Escape' && menu) { setOpenFor(null); menuRef.current?.focus(); } }}>
      <div className="tm-topline">
        <div className="tm-header-identity"><Link id="tm-brand" scroll={false} href={href('home')}>TERMINAL</Link><span>{designation ?? 'SEOUL / TECHNO PLATFORM'}</span></div>
        <div className="tm-header-module"><span className="tm-header-label">STANN OS / LIVE</span><div><h1 id="tm-screen-title" tabIndex={-1}>{code}</h1><button ref={menuRef} type="button" className="tm-module-toggle" aria-label={t('메뉴', 'Menu')} aria-expanded={menu} aria-controls="tm-module-navigation" onClick={() => setOpenFor(menu ? null : viewKey)}>⌄</button></div></div>
        <div className="tm-header-controls"><span className="tm-header-label">{eventStatus ?? 'TERMINAL / SEOUL'}</span><div><button type="button" aria-label={t('CRT 화면 효과', 'CRT display effects')} aria-pressed={crt} onClick={toggleCrt}>CRT {crt ? '■' : '□'}</button><button type="button" aria-label={t('영어로 보기', 'Switch to Korean')} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>{lang === 'ko' ? 'EN' : 'KO'}</button></div></div>
      </div>
      <nav ref={navigationRef} id="tm-module-navigation" className="tm-module-navigation" hidden={!menu} aria-label={t('전체 메뉴', 'All modules')}>
        <div ref={extraRef}>{groups.map(group => <section key={group.id}><h2>{group.code}</h2>{modules.filter(item => item.group === group.id).map(item => <Link key={item.page} scroll={false} href={href(item.page, ['gate', 'lineup'].includes(item.page) ? eventId : undefined)} aria-current={page === item.page ? 'page' : undefined} onClick={() => { setOpenFor(null); if (page === item.page) menuRef.current?.focus(); }}><span className="tm-nav-code">{item.code}</span><span>{item[lang]}</span></Link>)}</section>)}</div>
      </nav>
    </header>
    <main ref={mainRef} id="main-content" tabIndex={-1} className="tm-main">{children}</main>
    <footer hidden={entry} className="tm-footer">
      <nav className="tm-groups" aria-label={t('주요 메뉴', 'Main navigation')}>{groups.map(group => <Link key={group.id} scroll={false} href={href(group.page, group.id === 'events' ? eventId : undefined)} aria-current={page !== 'home' && currentGroup === group.id ? 'location' : undefined}><span>{group.code}</span><small>{group[lang]}</small></Link>)}</nav>
      <div className="tm-footer-signature"><span className="tm-footer-wordmark">TERMINAL</span><span>SEOUL / TECHNO PLATFORM</span></div>
      <div className="tm-footer-status"><span>{pagePaths[page]}</span><Link scroll={false} href={href('link')}>{t('공식 채널', 'Official channels')} ↗</Link></div>
    </footer>
    <aside className="tm-stub tm-stub-right" hidden={entry} aria-hidden="true"><span>{eventId ?? 'EVENT DIRECTORY'}</span><strong>{currentGroup.toUpperCase()}</strong><span>KST / UTC+09</span></aside>
    {crt && <CrtSurface />}
  </div>;
}
