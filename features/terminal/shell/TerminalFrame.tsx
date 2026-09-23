'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/langContext';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { useEventScreen } from '../events/useEventScreen';
import { pagePaths, type Page } from '../events/data';
import { MotionProvider } from '../motion/MotionProvider';
import { Shell } from './Shell';

export function TerminalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [experience] = useUrlQueryState('experience');
  const { lang, setLang } = useLang();
  const { props, phase } = useEventScreen();
  const page: Page = pathname === '/' ? experience === 'terminal' ? 'entry' : 'home'
    : (Object.keys(pagePaths) as Page[]).find(page => pagePaths[page] === pathname) ?? 'home';
  const eventPage = ['home', 'gate', 'lineup', 'status'].includes(page);
  const screenPhase = eventPage ? phase : 'ready';
  const eventMotionKey = eventPage ? `${page === 'lineup' ? '' : props.event?.id}:${props.event?.status}` : '';
  const [crt, setCrt] = useState(true);
  useEffect(() => {
    try { setCrt(localStorage.getItem('terminal_crt_enabled') !== 'false'); } catch { /* Keep the default when storage is unavailable. */ }
  }, []);
  const toggleCrt = () => setCrt(previous => {
    try { localStorage.setItem('terminal_crt_enabled', String(!previous)); } catch { /* The current session still works. */ }
    return !previous;
  });
  return <MotionProvider crt={crt}><div className="tm-application">
    <Shell page={page} eventId={props.event?.id} pathname={pathname} ready={screenPhase !== 'loading'} viewKey={`${pathname}:${page}`} motionKey={`${pathname}:${page}:${screenPhase}:${eventMotionKey}:${lang}`} lang={lang} t={props.t} setLang={setLang} crt={crt} toggleCrt={toggleCrt}>
      <div data-active="true">{children}</div>
    </Shell>
  </div></MotionProvider>;
}
