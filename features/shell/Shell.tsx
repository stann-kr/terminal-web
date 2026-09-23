'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

const navigation = [['/', 'HOME', '홈'], ['/events', 'EVENTS', '이벤트'], ['/artists', 'ARTISTS', '아티스트'], ['/archive', 'ARCHIVE', '행사 기록'], ['/transmit', 'TRANSMIT', '방문자 로그']] as const;
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  return <div className={styles.frame}>
    <a href="#main" className={styles.skip}>본문으로 이동</a>
    <div className={styles.rail} aria-hidden="true"><span>TERMINAL / SEOUL</span><span>STANN LUMO</span></div>
    <div className={styles.core}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="TERMINAL 홈">TERMINAL<span>SEOUL TECHNO PLATFORM</span></Link>
        <div className={styles.identity}><span>EVENTS / PEOPLE / RECORDS</span><span>서울에서 이어지는 음악과 사람의 기록</span></div>
        <div className={styles.language} aria-label="콘텐츠 언어"><span>CONTENT</span>{(['ko','en'] as const).map(lang => <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>)}</div>
      </header>
      <nav className={styles.navigation} aria-label="주 메뉴">{navigation.map(([href,label,ko], index) => <Link key={href} href={href} aria-current={(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined}><span className={styles.number}>0{index + 1}</span><span>{label}<small>{ko}</small></span><span aria-hidden="true">↗</span></Link>)}</nav>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
      <footer className={styles.footer}><span>TERMINAL — MUSIC & PEOPLE</span><nav aria-label="보조 메뉴"><Link href="/signal">SIGNAL · 소식 신청</Link><Link href="/about">ABOUT · 소개 / 채널</Link></nav><span>ALL EVENT TIMES / KST</span></footer>
    </div>
    <div className={`${styles.rail} ${styles.right}`} aria-hidden="true"><span>ARCHIVE & CONTINUITY</span><span>TERMINAL</span></div>
  </div>;
}
