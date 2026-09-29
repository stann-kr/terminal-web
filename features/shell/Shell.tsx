'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { DataActivity } from '@/features/display/Display';
import { useDisplayPolicy } from '@/features/display/useDisplayPolicy';
import { Clock } from './Clock';
import { Ticker } from './Ticker';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

const navigation = [
  { href: '/', index: '01', label: 'HOME', ko: '홈' },
  { href: '/events', index: '02', label: 'EVENTS', ko: '이벤트' },
  { href: '/artists', index: '03', label: 'ARTISTS', ko: '아티스트' },
  { href: '/transmit', index: '04', label: 'LOG', ko: '방문자 로그' },
] as const;
const secondary = [
  { href: '/signal', label: 'SIGNAL', ko: '소식 신청' },
  { href: '/about', label: 'ABOUT', ko: '소개' },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const activeIndex = navigation.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname.startsWith(href));
  useDisplayPolicy(frame);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // A real route change lands keyboard focus on the new page.
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div ref={frame} className={styles.frame}>
      <a href="#main" className={styles.skip}>본문으로 이동</a>
      <header className={styles.top} data-surface="deep">
        <Link href="/" className={styles.brand} aria-label="TERMINAL 홈">
          <span className={styles.brandMark}>TERMINAL</span>
        </Link>
        <nav className={styles.tabs} aria-label="주 메뉴">
          {navigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.tab}
              aria-current={index === activeIndex ? 'page' : undefined}
            >
              <span aria-hidden="true" className={styles.tabIndex}>{item.index}</span>
              <span className={styles.tabLabel}>{item.label} <small>{item.ko}</small></span>
            </Link>
          ))}
        </nav>
        <div className={styles.system}>
          <DataActivity />
          <Clock />
          <div className={styles.language} role="group" aria-label="콘텐츠 언어">
            {(['ko', 'en'] as const).map(lang => (
              <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.node} aria-hidden="true">SEOUL NODE</p>
      </header>
      <main ref={main} id="main" aria-label="본문" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <footer className={styles.foot} data-surface="deep">
        <nav className={styles.secondary} aria-label="보조 메뉴">
          {secondary.map(item => (
            <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
              <b>{item.label}</b> {item.ko}
            </Link>
          ))}
        </nav>
        <Ticker />
        <p className={`${styles.node} ${styles.brandNode}`} aria-hidden="true">TERMINAL</p>
      </footer>
    </div>
  );
}
