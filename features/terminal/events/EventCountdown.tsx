'use client';

import { useEffect, useState } from 'react';
import { getEventDateTime } from '@/lib/events/lifecycle';
import type { ScreenProps } from './data';

export function EventCountdown({ event, t }: Pick<ScreenProps, 'event' | 't'>) {
  const [now, setNow] = useState<number | null>(null);
  const target = event ? getEventDateTime(event).getTime() : Number.NaN;
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
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); };
  }, [target]);
  if (!Number.isFinite(target)) return null;
  const seconds = Math.floor(Math.abs(target - (now ?? target)) / 1000);
  const units = [
    [t('일', 'DAYS'), Math.floor(seconds / 86400)],
    [t('시간', 'HRS'), Math.floor(seconds % 86400 / 3600)],
    [t('분', 'MIN'), Math.floor(seconds % 3600 / 60)],
    [t('초', 'SEC'), seconds % 60],
  ] as const;
  const remaining = (now === null || target > now);
  return <section className="tm-countdown tm-cell" role="timer" aria-live="off" aria-label={remaining ? t('이벤트 시작까지 남은 시간', 'Time until event start') : t('이벤트 시작 후 경과 시간', 'Time since event start')}>
    <div className="tm-countdown-mode"><p className="tm-eyebrow">{remaining ? 'T− COUNTDOWN' : 'T+ ELAPSED'}</p><p>{remaining ? t('이벤트 시작까지', 'Until the event starts') : t('이벤트 시작 이후', 'Since the event started')}</p></div>
    <dl>{units.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{now === null ? '—' : String(value).padStart(2, '0')}</dd></div>)}</dl>
  </section>;
}
