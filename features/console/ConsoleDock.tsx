'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useEvents } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { Console } from './Console';
import styles from './dock.module.css';

/**
 * The one console for the whole site. It lives in the persistent shell, so route changes keep
 * its session and draft. Route changes focus main. Home opens the log by default; elsewhere an explicit choice
 * (toggle, Esc or running a command) is kept until the user returns home.
 */
export function ConsoleDock() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { events } = useEvents();
  const [dock, setDock] = useState<{ path: string; open: boolean | null }>({ path: pathname, open: null });
  if (dock.path !== pathname) setDock({ path: pathname, open: pathname === '/' ? null : dock.open });
  const open = dock.open ?? pathname === '/';
  return (
    <section className={styles.dock} aria-label="명령 콘솔" data-console-dock="">
      <Console
        events={events ?? null}
        language={language}
        pathname={pathname}
        open={open}
        onOpenChange={value => setDock({ path: pathname, open: value })}
      />
    </section>
  );
}
