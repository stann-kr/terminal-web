'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { getEventBoundaryTimes, withEffectiveEventStatus } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import { requestJson } from '@/features/ui/http';
import { Loading, StateNotice } from '@/features/ui/Ui';

export function useEvents() {
  const query = useQuery({ queryKey: ['events'], queryFn: ({ signal }) => requestJson<TerminalEvent[]>('/api/events', { signal }) });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const boundaries = getEventBoundaryTimes(query.data ?? [], ACCESS_WINDOW_DAYS);
    const next = boundaries.find(time => time > Date.now());
    const timer = window.setTimeout(update, Math.min(60_000, next ? Math.max(1,next - Date.now()) : 60_000));
    window.addEventListener('focus', update);
    return () => { clearTimeout(timer); window.removeEventListener('focus', update); };
  }, [now, query.data]);
  return { ...query, now, events: query.data?.map(event => withEffectiveEventStatus(event,now)) };
}
export function EventsData({ children }: { children: (events: TerminalEvent[], now: Date) => ReactNode }) {
  const query = useEvents();
  if (!query.events) return query.isError ? <StateNotice error title="행사 기록을 불러오지 못했습니다" retry={() => void query.refetch()}/> : <Loading />;
  return <>{query.isError && <StateNotice error title="최신 정보를 불러오지 못했습니다" retry={() => void query.refetch()}>아래는 마지막으로 확인한 기록입니다.</StateNotice>}{children(query.events, query.now)}</>;
}
