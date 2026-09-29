'use client';
import { useEffect, useState } from 'react';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { TerminalEvent } from '@/lib/events/types';
import { LiveValue } from '@/features/display/Display';
import styles from './home.module.css';

export function EventCountdown({
  event,
}: {
  event: Pick<TerminalEvent, 'date' | 'time'>;
}) {
  const target = getEventDateTime(event).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      if (document.visibilityState === 'hidden') return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [target]);

  if (!Number.isFinite(target)) return null;
  const remaining = now === null || target > now;
  const delta = Math.abs(target - (now ?? target)) / 1000;
  const seconds = remaining ? Math.ceil(delta) : Math.floor(delta);
  const units = [
    ['일', Math.floor(seconds / 86400)],
    ['시간', Math.floor((seconds % 86400) / 3600)],
    ['분', Math.floor((seconds % 3600) / 60)],
    ['초', seconds % 60],
  ] as const;
  return (
    <section
      className={styles.countdown}
      role="timer"
      aria-live="off"
      aria-label={
        remaining ? '이벤트 시작까지 남은 시간' : '이벤트 시작 후 경과 시간'
      }
    >
      <div className={styles.countdownMode}>
        <span>{remaining ? 'T- COUNTDOWN' : 'T+ ELAPSED'}</span>
        <span>{remaining ? '이벤트 시작까지' : '이벤트 시작 이후'}</span>
      </div>
      <dl className={styles.countdownUnits} data-cells="">
        {units.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <LiveValue
                value={now === null ? '—' : String(value).padStart(2, '0')}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
