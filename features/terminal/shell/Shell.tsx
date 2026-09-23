'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { href, pagePaths, type Lang, type Page, type Translate } from '../events/data';
import { gsap, useGSAP, useMotionEnabled } from '../motion/MotionProvider';
import { useReadoutMotion } from '../motion/useReadoutMotion';
import { CrtSurface } from '../motion/CrtSurface';
import { useNavigationContinuity } from './useNavigationContinuity';
import '../motion/motion.css';
import './shell.css';

const directory = [
  { page: 'gate', code: 'EVENT FILE', ko: '행사 정보', en: 'Event details', group: 'events' },
  { page: 'lineup', code: 'LINEUP', ko: '라인업', en: 'Lineup', group: 'events' },
  { page: 'status', code: 'ARCHIVE', ko: '지난 행사', en: 'Archive', group: 'events' },
  { page: 'transmit', code: 'TRANSMIT', ko: '방명록', en: 'Guestbook', group: 'comms' },
  { page: 'signal', code: 'SIGNAL', ko: '소식 받기', en: 'Updates', group: 'comms' },
  { page: 'link', code: 'CHANNELS', ko: '공식 채널', en: 'Channels', group: 'comms' },
  { page: 'about', code: 'ABOUT', ko: '터미널 소개', en: 'About TERMINAL', group: 'about' },
  { page: 'entry', code: 'ENTER', ko: '터미널 체험', en: 'Terminal experience', group: 'about' },
] satisfies { page: Page; code: string; ko: string; en: string; group: string }[];
const groups = [
  { id: 'events', page: 'gate', code: 'EVENTS', ko: '이벤트', en: 'Events' },
  { id: 'comms', page: 'transmit', code: 'COMMS', ko: '소통', en: 'Communications' },
  { id: 'about', page: 'about', code: 'ABOUT', ko: '소개', en: 'About' },
] satisfies { id: string; page: Page; code: string; ko: string; en: string }[];

export function Shell({ page, eventId, viewKey, pathname, ready, motionKey, lang, t, setLang, crt, toggleCrt, children }: { page: Page; eventId?: string; viewKey: string; pathname: string; ready: boolean; motionKey: string; lang: Lang; t: Translate; setLang: (lang: Lang) => void; crt: boolean; toggleCrt: () => void; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const extraRef = useRef<HTMLDivElement>(null);
  const lastPage = useRef(viewKey);
  const mainRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const enabled = useMotionEnabled();
  const entry = page === 'entry';
  const wasEntry = useRef(entry);
  useNavigationContinuity(mainRef, pathname, ready);
  useReadoutMotion(mainRef, { key: motionKey, active: !entry, content: '[data-active=true]', layout: true });
  useReadoutMotion(headerRef, { key: entry ? 'entry' : 'desktop', active: !entry, controls: '.tm-topline,.tm-navigation' });
  useReadoutMotion(extraRef, { key: `${menu}:${page}`, active: menu && !entry, content: 'a > span:not(.tm-nav-code)' });
  useGSAP(() => {
    const entering = wasEntry.current && !entry;
    wasEntry.current = entry;
    if (!enabled || !entering) return;
    gsap.timeline().fromTo('[data-shell-charge]', { opacity: 0 }, { opacity: 1, duration: 0.12 })
      .to('[data-shell-charge]', { opacity: 0, duration: 0.55, ease: 'power2.out' });
  }, { scope: shellRef, dependencies: [entry, enabled], revertOnUpdate: true });
  useEffect(() => {
    if (lastPage.current !== viewKey) {
      setMenu(false);
      lastPage.current = viewKey;
    }
  }, [viewKey]);
  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setMenu(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [menu]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    let focused = document.activeElement;
    const rememberFocus = (event: FocusEvent) => { if (event.target instanceof Element) focused = event.target; };
    const close = () => {
      // CSS may hide the focused node before matchMedia dispatches its change.
      if (!media.matches && extraRef.current?.contains(focused)) menuRef.current?.focus({ preventScroll: true });
      if (media.matches && (focused === menuRef.current || extraRef.current?.contains(focused))) document.getElementById('tm-brand')?.focus({ preventScroll: true });
      setMenu(false);
    };
    document.addEventListener('focusin', rememberFocus);
    media.addEventListener('change', close);
    return () => { media.removeEventListener('change', close); document.removeEventListener('focusin', rememberFocus); };
  }, []);
  const currentGroup = page === 'request' || page === 'home' ? 'events' : directory.find(item => item.page === page)?.group ?? 'events';
  const navLink = (item: typeof directory[number]) => <Link key={item.page} scroll={false}
    href={href(item.page, ['gate', 'lineup'].includes(item.page) ? eventId : undefined)}
    aria-current={page === item.page ? 'page' : undefined}
    onClick={() => { setMenu(false); if (page === item.page && window.matchMedia('(max-width: 767px)').matches) menuRef.current?.focus({ preventScroll: true }); }}>
    <span className="tm-nav-code">{item.code}</span><span>{item[lang]}</span>
  </Link>;
  return <div ref={shellRef} className="tm-shell" data-crt={crt} data-motion={enabled} data-entry={entry}>
    <a hidden={entry} className="tm-skip" href="#main-content" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>{t('본문으로 건너뛰기', 'Skip to content')}</a>
    <aside className="tm-stub tm-stub-left" hidden={entry} aria-hidden="true"><span>STANN OS / LIVE</span><strong>TERMINAL</strong><span>SEOUL / KR</span></aside>
    <header ref={headerRef} hidden={entry} className="tm-header" onKeyDown={e => { if (e.key === 'Escape' && menu) { setMenu(false); menuRef.current?.focus(); } }}>
      <div className="tm-topline">
        <Link id="tm-brand" className="tm-brand" scroll={false} href={href('home')}><span className="tm-wordmark">TERMINAL</span><span className="tm-brand-location">SEOUL / TECHNO PLATFORM</span></Link>
        <div className="tm-screen-designation"><span>STANN OS / LIVE</span><strong>{page === 'home' ? 'EVENT OVERVIEW' : page === 'request' ? 'GUEST REQUEST' : page.toUpperCase()}</strong></div>
        <div className="tm-utilities">
          <button type="button" aria-label={t('CRT 화면 효과', 'CRT display effects')} aria-pressed={crt} onClick={toggleCrt}>CRT <span aria-hidden="true">{crt ? '■' : '□'}</span></button>
          <button type="button" aria-label={t('영어로 보기', 'Switch to Korean')} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>{lang === 'ko' ? 'EN' : 'KO'}</button>
          <button ref={menuRef} className="tm-menu-toggle" type="button" aria-expanded={menu} aria-controls="tm-extra-navigation" onClick={() => setMenu(!menu)}>{t('메뉴', 'Menu')} [{menu ? '−' : '+'}]</button>
        </div>
      </div>
      <nav ref={navigationRef} id="tm-navigation" className="tm-navigation" data-open={menu} aria-label={t('주요 메뉴', 'Main navigation')}>
        <div className="tm-navigation-groups">{groups.map(group => <Link key={group.id} scroll={false} href={href(group.page, group.id === 'events' ? eventId : undefined)} aria-current={page !== 'home' && currentGroup === group.id ? 'location' : undefined} onClick={() => setMenu(false)}><span className="tm-nav-code">{group.code}</span><span>{group[lang]}</span></Link>)}</div>
        <div className="tm-subnavigation">{directory.filter(item => item.group === currentGroup).map(navLink)}</div>
        <div ref={extraRef} id="tm-extra-navigation" className="tm-extra-navigation" hidden={!menu}>
          {groups.map(group => <section key={group.id}><h2>{group.code}</h2>{directory.filter(item => item.group === group.id).map(navLink)}</section>)}
        </div>
      </nav>
    </header>
    <main ref={mainRef} id="main-content" tabIndex={-1} className="tm-main">{children}</main>
    <footer hidden={entry} className="tm-footer"><div><span>STANN OS / LIVE</span><span className="tm-path">{pagePaths[page]}</span></div><span className="tm-footer-wordmark" aria-hidden="true">TERMINAL</span><Link href={href('link')}>{t('공식 채널', 'Official channels')} <span aria-hidden="true">↗</span></Link></footer>
    <aside className="tm-stub tm-stub-right" hidden={entry} aria-hidden="true"><span>{eventId ?? 'EVENT DIRECTORY'}</span><strong>{page === 'home' ? 'COMMAND ACCESS' : currentGroup.toUpperCase()}</strong><span>KST / UTC+09</span></aside>
    {crt && <CrtSurface main={mainRef} viewKey={viewKey} motionKey={motionKey} />}
  </div>;
}
