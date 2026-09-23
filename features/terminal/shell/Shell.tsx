'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { href, pagePaths, type Lang, type Page, type Translate } from '../events/data';
import { gsap, useGSAP, useMotionEnabled } from '../motion/MotionProvider';
import { useReadoutMotion } from '../motion/useReadoutMotion';
import { useNavigationContinuity } from './useNavigationContinuity';
import '../motion/motion.css';
import './shell.css';

const directory: { page: Page; code: string; ko: string; en: string }[] = [
  { page: 'gate', code: 'GATE', ko: '이벤트', en: 'Events' },
  { page: 'lineup', code: 'LINEUP', ko: '라인업', en: 'Lineup' },
  { page: 'request', code: 'GUEST_REQ', ko: '게스트 신청', en: 'Guest request' },
  { page: 'status', code: 'STATUS', ko: '이벤트 기록', en: 'History' },
  { page: 'transmit', code: 'TRANSMIT', ko: '방명록', en: 'Guestbook' },
  { page: 'signal', code: 'SIGNAL', ko: '소식 신청', en: 'Updates' },
  { page: 'about', code: 'ABOUT', ko: '소개', en: 'About' },
];

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
    const media = window.matchMedia('(min-width: 900px)');
    let focused = document.activeElement;
    const rememberFocus = (event: FocusEvent) => { if (event.target instanceof Element) focused = event.target; };
    const close = () => {
      // CSS may hide the focused node before matchMedia dispatches its change.
      if (!media.matches && extraRef.current?.contains(focused)) menuRef.current?.focus({ preventScroll: true });
      if (media.matches && (focused === menuRef.current || focused?.classList.contains('tm-mobile-channels'))) document.getElementById('tm-brand')?.focus({ preventScroll: true });
      setMenu(false);
    };
    document.addEventListener('focusin', rememberFocus);
    media.addEventListener('change', close);
    return () => { media.removeEventListener('change', close); document.removeEventListener('focusin', rememberFocus); };
  }, []);
  const navLink = (item: typeof directory[number]) => <Link key={item.page} scroll={false} href={href(item.page, ['gate', 'lineup', 'request'].includes(item.page) ? eventId : undefined)} aria-current={page === item.page ? 'page' : undefined} onClick={() => { setMenu(false); if (page === item.page && window.matchMedia('(max-width: 899px)').matches) menuRef.current?.focus({ preventScroll: true }); }}><span className="tm-nav-code">{item.code}</span><span>{item[lang]}</span></Link>;
  const currentExtra = directory.slice(3).find(item => item.page === page);
  return <div ref={shellRef} className="tm-shell" data-crt={crt} data-motion={enabled}>
    <a hidden={page === 'entry'} className="tm-skip" href="#main-content" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>{t('본문으로 건너뛰기', 'Skip to content')}</a>
    <header ref={headerRef} hidden={page === 'entry'} className="tm-header" onKeyDown={e => { if (e.key === 'Escape' && menu) { setMenu(false); menuRef.current?.focus(); } }}>
      <div className="tm-topline"><Link id="tm-brand" className="tm-brand" scroll={false} href={href('home')}><span className="tm-wordmark">TERMINAL</span><span className="tm-brand-location">{' // SEOUL'}</span></Link><div className="tm-utilities"><Link className="tm-channel-link" scroll={false} href={href('link')}>{t('공식 채널', 'Channels')}</Link><button type="button" aria-label={t('CRT 화면 효과', 'CRT display effects')} aria-pressed={crt} onClick={toggleCrt}>CRT <span aria-hidden="true">{crt ? '■' : '□'}</span></button><button type="button" aria-label={t('영어로 보기', 'Switch to Korean')} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>{lang === 'ko' ? 'EN' : 'KO'}</button><button ref={menuRef} className="tm-menu-toggle" hidden={page === 'entry'} type="button" aria-expanded={menu} aria-controls="tm-extra-navigation" onClick={() => setMenu(!menu)}><span>{t('메뉴', 'Menu')} [{menu ? '−' : '+'}]</span>{(currentExtra || page === 'link') && <span className="tm-current-page">{currentExtra?.code ?? 'LINK'}</span>}</button></div></div>
      <nav hidden={page === 'entry'} ref={navigationRef} id="tm-navigation" className="tm-navigation" data-open={menu} aria-label={t('주요 메뉴', 'Main navigation')}>
        {directory.slice(0, 3).map(navLink)}
        <div ref={extraRef} id="tm-extra-navigation" className="tm-extra-navigation">
          {directory.slice(3).map(navLink)}
          <Link className="tm-mobile-channels" scroll={false} href={href('link')} aria-current={page === 'link' ? 'page' : undefined} onClick={() => setMenu(false)}><span>{t('공식 채널', 'Channels')}</span></Link>
        </div>
      </nav>
    </header>
    <main ref={mainRef} id="main-content" tabIndex={-1} className="tm-main">{children}</main>
    <footer hidden={page === 'entry'} className="tm-footer"><span>STANN OS / LIVE</span><span className="tm-path">{pagePaths[page]}</span><Link href={href('link')}>{t('공식 채널', 'Official channels')}</Link></footer>
    {crt && <div className="tm-glass" aria-hidden="true"><div className="tm-phosphor" /><div className="tm-grain" /><div className="tm-raster" /><div className="tm-vignette" /><div className="tm-reflection" /><div data-shell-charge className="tm-shell-charge" /></div>}
  </div>;
}
