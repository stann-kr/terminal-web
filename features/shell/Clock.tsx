'use client';
import { useEffect, useState } from 'react';
import styles from './shell.module.css';

const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** Real Seoul time. The server and first client render show a placeholder, so hydration stays stable. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, 1000 - current.getMilliseconds());
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return (
    <time className={styles.clock} dateTime={now?.toISOString()}>
      <span className={styles.srOnly}>서울 현재 시각 </span>
      <span aria-hidden="true" className={styles.clockZone}>KST</span>
      {now ? format.format(now) : '--:--:--'}
    </time>
  );
}
