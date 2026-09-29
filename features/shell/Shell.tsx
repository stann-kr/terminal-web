'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { DataActivity } from '@/features/display/Display';
import { Blocks } from '@/features/display/Blocks';
import { Ticks } from '@/features/display/Instruments';
import { useDisplayPolicy } from '@/features/display/useDisplayPolicy';
import { ConsoleDock } from '@/features/console/ConsoleDock';
import { CONSOLE_INPUT_ID } from '@/features/console/Console';
import { shellPath } from '@/features/console/commands';
import { Clock } from './Clock';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

const navigation = [
  { href: '/', key: 'F1', label: 'HOME', ko: '홈' },
  { href: '/events', key: 'F2', label: 'EVENTS', ko: '이벤트' },
  { href: '/artists', key: 'F3', label: 'ARTISTS', ko: '아티스트' },
  { href: '/transmit', key: 'F4', label: 'LOG', ko: '방문자 로그' },
] as const;
const secondary = [
  { href: '/signal', label: 'SIGNAL', ko: '소식 신청' },
  { href: '/about', label: 'ABOUT', ko: '소개' },
] as const;
// Printed section codes, like the station numbers beside each panel; decoration only.
const sections = [
  ['/events', '02', 'EVENTS'],
  ['/artists', '03', 'ARTISTS'],
  ['/transmit', '04', 'LOG'],
  ['/signal', '05', 'SIGNAL'],
  ['/about', '06', 'ABOUT'],
] as const;
function sectionOf(pathname: string) {
  const match = sections.find(([href]) => pathname.startsWith(href));
  return match ? { code: match[1], label: match[2] } : { code: '01', label: 'HOME' };
}
const BOOT_KEY = 'terminal.boot.v1';
// Runs while the HTML is parsed, before first paint: power-on once per tab session, never on save-data.
const bootScript = `(function(){var b=document.currentScript&&document.currentScript.previousElementSibling;try{var c=navigator.connection;if(b&&!sessionStorage.getItem('${BOOT_KEY}')&&!(c&&c.saveData))b.setAttribute('data-play','');sessionStorage.setItem('${BOOT_KEY}','1')}catch(e){}})()`;

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input,textarea,select'));
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null), boot = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const fetching = useIsFetching() > 0;
  // The raster wipe is keyed by navigation, not by remounting the route; the first render has none.
  const [route, setRoute] = useState({ path: pathname, wipe: false });
  if (route.path !== pathname) setRoute({ path: pathname, wipe: true });
  const activeIndex = navigation.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname.startsWith(href));
  const section = sectionOf(pathname);
  useDisplayPolicy(frame);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // Every real route change, including cd and F-keys, lands on the new main; the console keeps its session.
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    if (!route.wipe) return;
    // Clearing the marker after the 240ms pass prevents FX/visibility changes from replaying it.
    const timer = setTimeout(() => setRoute(current => current.path === route.path ? { ...current, wipe: false } : current), 320);
    return () => clearTimeout(timer);
  }, [route]);

  useEffect(() => {
    // The boot log prints for ~650ms and retracts by ~950ms; the marker is cleared after it.
    const timer = setTimeout(() => boot.current?.removeAttribute('data-play'), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = navigation.find(item => item.key === event.key);
      if (target && !event.shiftKey) {
        event.preventDefault();
        if (!event.repeat && target.href !== pathname) router.push(target.href);
        return;
      }
      if (event.key === '/' && !isTyping(event.target)) {
        const input = document.getElementById(CONSOLE_INPUT_ID);
        if (!input) return;
        event.preventDefault();
        input.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pathname, router]);

  return (
    <div ref={frame} className={styles.frame}>
      <a href="#main" className={styles.skip}>본문으로 이동</a>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="TERMINAL 홈" data-surface="mint">
          <span className={styles.brandName}>TERMINAL</span>
          <small aria-hidden="true">SEOUL TECHNO PLATFORM</small>
        </Link>
        <nav className={styles.tabs} aria-label="주 메뉴">
          {navigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.tab}
              aria-current={index === activeIndex ? 'page' : undefined}
              aria-keyshortcuts={item.key}
            >
              <span aria-hidden="true" className={styles.fkey}>{item.key}</span>
              <span className={styles.tabLabel}>{item.label} <small>{item.ko}</small></span>
            </Link>
          ))}
        </nav>
        <div className={styles.system}>
          <p className={styles.unit} aria-hidden="true"><span>UNIT</span>T-03</p>
          <Clock />
          <div className={styles.language} role="group" aria-label="콘텐츠 언어">
            {(['ko', 'en'] as const).map(lang => (
              <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className={styles.status}>
        <p className={styles.section} aria-hidden="true" data-surface="sand">
          <b>{section.code}</b>
          <span>{section.label}</span>
        </p>
        <p className={styles.path}>
          <span className={styles.srOnly}>현재 위치 </span>
          guest@terminal:{shellPath(pathname)}
        </p>
        <Ticks count={60} major={10} className={styles.statusScale} />
        <Blocks cols={8} motion="scan" step={fetching ? 60 : 240} tone={fetching ? 'sand' : 'mint'} className={styles.statusBlocks} />
        <DataActivity />
      </div>
      <main ref={main} id="main" aria-label="본문" tabIndex={0} className={styles.main} data-wipe={route.wipe || undefined}>
        {children}
      </main>
      <ConsoleDock />
      <footer className={styles.hints}>
        <p className={styles.keyHints} aria-hidden="true">
          <span><kbd>F1–F4</kbd> 화면</span>
          <span><kbd>/</kbd> 명령줄</span>
          <span><kbd>ESC</kbd> 출력 접기</span>
        </p>
        <nav className={styles.secondary} aria-label="보조 메뉴">
          {secondary.map(item => (
            <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
              <b>{item.label}</b> {item.ko}
            </Link>
          ))}
        </nav>
        <p className={styles.zone}>ALL EVENT TIMES / KST</p>
        <p className={styles.hatchTag} aria-hidden="true">SEOUL NODE</p>
      </footer>
      <i className={styles.wipeLine} aria-hidden="true" />
      <div ref={boot} className={styles.boot} aria-hidden="true" suppressHydrationWarning>
        <p data-surface="mint"><b>TERMINAL</b><span>SEOUL NODE</span></p>
        <p><span>T-03 INTERFACE</span><b>ONLINE</b></p>
        <p><span>EVENT RECORDS</span><b>READ</b></p>
        <p data-surface="sand"><span>SESSION</span><b>OPEN</b></p>
      </div>
      <script type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootScript }} />
    </div>
  );
}
