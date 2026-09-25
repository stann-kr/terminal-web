'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DataActivity, DisplaySurface } from '@/features/display/Display';
import { useDisplayMotion } from '@/features/display/useDisplayMotion';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

const navigation = [['/', 'HOME', '홈'], ['/events', 'EVENTS', '이벤트'], ['/artists', 'ARTISTS', '아티스트'], ['/transmit', 'TRANSMIT', '방문자 로그']] as const;
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null), previousPath = useRef(pathname);
  const [effects,setEffects] = useState(true);
  const activeIndex = navigation.findIndex(([href]) => href === '/' ? pathname === '/' : pathname.startsWith(href));
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    main.current?.focus({preventScroll:true});
  },[pathname]);
  useDisplayMotion(frame,`${pathname}:${language}`);
  return <div ref={frame} className={styles.frame} data-effects-off={effects ? undefined : ''}>
    <DisplaySurface/>
    <a href="#main" className={styles.skip}>본문으로 이동</a>
    <div className={styles.rail} aria-hidden="true"><span>TERMINAL / SEOUL</span><span className={styles.railTitle}>STANN LUMO</span><span>MUSIC / PEOPLE / RECORDS</span></div>
    <div className={styles.core}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="TERMINAL 홈">TERMINAL<span>SEOUL TECHNO PLATFORM</span></Link>
        <nav className={styles.navigation} aria-label="주 메뉴" data-active={activeIndex >= 0} style={{'--nav-position':`${Math.max(0,activeIndex)*100}%`} as CSSProperties}>{navigation.map(([href,label,ko], index) => <Link key={href} href={href} aria-current={index === activeIndex ? 'page' : undefined}><span className={styles.number}>0{index + 1}</span><span>{label}<small>{ko}</small></span></Link>)}</nav>
        <div className={styles.language} aria-label="콘텐츠 언어"><span>CONTENT</span><DataActivity/>{(['ko','en'] as const).map(lang => <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>)}</div>
      </header>
      <main ref={main} id="main" aria-label="본문" tabIndex={0} className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.imprint}><div className={styles.barcode} aria-hidden="true"/><span>MUSIC / PEOPLE / RECORDS</span></div>
        <div className={styles.footerCenter}><nav aria-label="보조 메뉴"><Link href="/signal">SIGNAL · 소식 신청</Link><Link href="/about">ABOUT · 소개 / 채널</Link><button type="button" className={styles.effects} aria-label="화면 효과" aria-pressed={effects} onClick={() => setEffects(value => !value)}>FX {effects ? 'ON' : 'OFF'}</button></nav><span>ALL EVENT TIMES / KST</span></div>
        <div className={styles.signature}><div className={styles.symbols} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19"/><circle cx="12" cy="12" r="8"/></svg><svg viewBox="0 0 24 24"><path d="M4 18 12 4l8 14H4Zm4-5h8M12 9v8"/></svg></div><div className={styles.wordmark}>TERMINAL<small>STANN LUMO / SEOUL</small></div></div>
      </footer>
    </div>
    <div className={`${styles.rail} ${styles.right}`} aria-hidden="true"><span>EVENTS / ARTISTS</span><span className={styles.railTitle}>ARCHIVE & CONTINUITY</span><span>TERMINAL / KST</span></div>
  </div>;
}
