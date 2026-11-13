'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useDisplayPolicy } from '@/features/display/useDisplayPolicy';
import { AccessDraftProvider } from '@/features/access/AccessDraftProvider';
import { stageConfig } from '@/features/stage/config';
import { Stage } from '@/features/stage/Stage';
import { stageStateFromUrl } from '@/features/stage/state';
import { ConsoleCursor } from './ConsoleCursor';
import { useNavigationPending, useSweepDirection, useTouchPress } from './useConsoleMotion';
import styles from './shell.module.css';

type Address = { pathname: string; search: string };

/**
 * Reads the query string for the stage. Kept in its own Suspense boundary, so the stage itself is
 * part of the server's first HTML while only this reader waits for the client. It reports the
 * query with the path it was read for, so the two always travel as one address.
 */
function SearchSync({ onChange }: { onChange: (address: Address) => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useLayoutEffect(() => onChange({ pathname, search }), [pathname, search, onChange]);
  return null;
}

/**
 * The console is the stage and nothing else: no header or footer, the wordmark rides on the
 * next-session plate. The address decides the stage state; a page outside the stage (not found,
 * errors) shows in its place.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The query reaches the shell one commit after its path (see SearchSync). Until the first report
  // the stage reads the path alone, as the server's HTML did; after it, a path whose query has not
  // been reported yet keeps the last whole address, so a new path never pairs with an old query.
  const [synced, setSynced] = useState<Address | null>(null);
  const address = synced ?? { pathname, search: '' };
  const state = stageStateFromUrl(address.pathname, new URLSearchParams(address.search));
  const report = useCallback((next: Address) => setSynced(last => (last?.pathname === next.pathname && last.search === next.search ? last : next)), []);
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(address.pathname);
  useDisplayPolicy(frame);
  useSweepDirection();
  useTouchPress();
  useNavigationPending(`${address.pathname}?${address.search}`);

  // Read from the address the stage shows, so the path and the view it decides change together.
  useEffect(() => {
    if (previousPath.current === address.pathname) return;
    previousPath.current = address.pathname;
    // The stage moves focus to its own views; a page outside it gets focus here.
    if (state.view === 'none') main.current?.focus({ preventScroll: true });
  }, [address.pathname, state.view]);

  const bars = { '--frame-y': `${stageConfig.frameY}px` } as CSSProperties;

  return (
    <div ref={frame} className={styles.frame} style={bars}>
      <a href="#main" className={styles.skip}>본문으로 이동</a>
      <Suspense fallback={null}>
        <SearchSync onChange={report} />
      </Suspense>
      <main ref={main} id="main" aria-label="본문" tabIndex={-1} className={styles.main}>
        <AccessDraftProvider>
          <Stage state={state} addressKnown={!!synced} />
          {children}
        </AccessDraftProvider>
      </main>
      <ConsoleCursor />
    </div>
  );
}
