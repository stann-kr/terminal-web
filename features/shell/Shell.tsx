'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DataActivity } from '@/features/display/Display';
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
  const [effects, setEffects] = useState(true);
  // The raster wipe is keyed by navigation, not by remounting the route; the first render has none.
  const [route, setRoute] = useState({ path: pathname, wipe: false });
  if (route.path !== pathname) setRoute({ path: pathname, wipe: true });
  const activeIndex = navigation.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname.startsWith(href));
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
    const timer = setTimeout(() => boot.current?.removeAttribute('data-play'), 600);
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

  const controls = (
    <div className={styles.controls}>
      <button type="button" className={styles.fx} aria-label="화면 효과" aria-pressed={effects} onClick={() => setEffects(value => !value)}>
        <i aria-hidden="true" className={styles.led} />
        <span aria-hidden="true">FX</span>
      </button>
      <div className={styles.rocker} role="group" aria-label="콘텐츠 언어">
        {(['ko', 'en'] as const).map(lang => (
          <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={frame} className={styles.housing} data-effects-off={effects ? undefined : ''}>
      <a href="#main" className={styles.skip}>본문으로 이동</a>
      <header className={styles.plate}>
        <Link href="/" className={styles.brand} aria-label="TERMINAL 홈">TERMINAL</Link>
        <p className={styles.model}>MODEL T-03 · SEOUL TECHNO PLATFORM</p>
        <span className={styles.vents} aria-hidden="true" />
        <Clock />
      </header>
      <div className={styles.bezel}>
        <div className={styles.glass}>
          <div className={styles.screen}>
            <div className={styles.status}>
              <p className={styles.path}><span className={styles.srOnly}>현재 위치 </span>guest@terminal:{shellPath(pathname)}</p>
              <DataActivity />
            </div>
            <main ref={main} id="main" aria-label="본문" tabIndex={0} className={styles.main} data-wipe={route.wipe || undefined}>
              <div className={styles.content}>{children}</div>
              <nav className={styles.screenLinks} aria-label="보조 메뉴">
                {secondary.map(item => <Link key={item.href} href={item.href}>{item.label} <small>{item.ko}</small></Link>)}
                <span>ALL EVENT TIMES / KST</span>
              </nav>
            </main>
            <ConsoleDock />
          </div>
          <div className={styles.glassFx} aria-hidden="true"><i className={styles.band} /></div>
          <div ref={boot} className={styles.boot} aria-hidden="true" suppressHydrationWarning />
          <script type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootScript }} />
        </div>
      </div>
      <footer className={styles.deck}>
        <nav className={styles.keys} aria-label="주 메뉴">
          {navigation.map((item, index) => (
            <Link key={item.href} href={item.href} className={styles.key} aria-current={index === activeIndex ? 'page' : undefined} aria-keyshortcuts={item.key}>
              <span aria-hidden="true" className={styles.fkey}>{item.key}</span>
              <span className={styles.legend}>{item.label} <small>{item.ko}</small></span>
            </Link>
          ))}
        </nav>
        <nav className={`${styles.keys} ${styles.auxKeys}`} aria-label="보조 메뉴">
          {secondary.map(item => (
            <Link key={item.href} href={item.href} className={styles.key} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
              <span className={styles.legend}>{item.label} <small>{item.ko}</small></span>
            </Link>
          ))}
        </nav>
        <div className={styles.serial}>
          <span className={styles.barcode} aria-hidden="true" />
          <span>TERMINAL / STANN LUMO<br />ALL EVENT TIMES / KST</span>
        </div>
      </footer>
      {controls}
    </div>
  );
}
