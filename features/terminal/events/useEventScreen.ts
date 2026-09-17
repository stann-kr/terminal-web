'use client';

import { useQuery } from '@tanstack/react-query';
import { eventKeys, fetchEvents } from '@/lib/events/client';
import { getDefaultEvent, getEffectiveEventStatus } from '@/lib/events/lifecycle';
import { useEventClock } from '@/lib/events/useEventClock';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import { useLang } from '@/lib/langContext';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import type { ScreenProps } from './data';
import { withMinimumLoading } from '../shared/minimumLoading';

const loadEvents = () => withMinimumLoading(fetchEvents);

export function useEventScreen() {
  const { lang } = useLang();
  const [eventId] = useUrlQueryState('event');
  const [view] = useUrlQueryState('view');
  const query = useQuery({ queryKey: eventKeys.list(), queryFn: loadEvents });
  const now = useEventClock(query.data ?? [], ACCESS_WINDOW_DAYS);
  const events = (query.data ?? []).map(event => ({ ...event, status: getEffectiveEventStatus(event, now) }));
  const candidates = view === 'archive' ? events.filter(event => event.status === 'ARCHIVED')
    : view === 'upcoming' ? events.filter(event => event.status !== 'ARCHIVED') : events;
  // An explicit missing ID must never silently show another event's actions.
  const event = eventId ? events.find(event => event.id === eventId) ?? null : getDefaultEvent(candidates, now);
  const props: ScreenProps = { lang, t: (ko, en) => lang === 'ko' ? ko : en, event, events, now };
  // A background refresh must not replace content already on screen.
  const phase = query.data !== undefined ? 'ready' : query.isError ? 'error' : 'loading';
  return { ...query, props, eventId, phase };
}
