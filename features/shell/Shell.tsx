'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useDisplayPolicy } from '@/features/display/useDisplayPolicy';
import { stageConfig } from '@/features/stage/config';
import { Stage } from '@/features/stage/Stage';
import { stageStateFromUrl } from '@/features/stage/state';
import { StatusLine } from './StatusLine';
import { Ticker } from './Ticker';
import { ConsoleCursor } from './ConsoleCursor';
import { useSmoothWheel, useSweepDirection } from './useConsoleMotion';
import styles from './shell.module.css';

/**
 * Reads the query string for the stage. Kept in its own Suspense boundary, so the stage itself is
 * part of the server's first HTML while only this reader waits for the client.
 */
function SearchSync({ onChange }: { onChange: (search: string) => void }) {
  const search = useSearchParams().toString();
  useLayoutEffect(() => onChange(search), [search, onChange]);
  return null;
}

/**
 * The console: a status line, the stage, and the schedule ticker. The address decides the stage
 * state; a page outside the stage (not found, errors) shows in its place.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const state = stageStateFromUrl(pathname, new URLSearchParams(search));
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useDisplayPolicy(frame);
  useSweepDirection();
  useSmoothWheel();

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // The stage moves focus to its own views; a page outside it gets focus here.
    if (state.view === 'none') main.current?.focus({ preventScroll: true });
  }, [pathname, state.view]);

  const bars = {
    '--status-h': `${stageConfig.statusH}px`,
    '--ticker-h': `${stageConfig.tickerH}px`,
    '--frame-y': `${stageConfig.frameY}px`,
  } as CSSProperties;

  return (
    <div ref={frame} className={styles.frame} style={bars} data-ticker={stageConfig.ticker || undefined}>
      <a href="#main" className={styles.skip}>본문으로 이동</a>
      <Suspense fallback={null}>
        <SearchSync onChange={setSearch} />
      </Suspense>
      <StatusLine state={state} />
      <main ref={main} id="main" aria-label="본문" tabIndex={-1} className={styles.main}>
        <Stage state={state} />
        {children}
      </main>
      <ConsoleCursor />
      {stageConfig.ticker && (
        <footer className={styles.foot} data-surface="deep">
          <Ticker />
        </footer>
      )}
    </div>
  );
}
