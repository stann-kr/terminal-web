'use client';
import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { useSearchParams } from 'next/navigation';
import {
  getArchivedOrElapsedEvents,
  getFutureUpcomingEvent,
  getLiveEvents,
} from '@/lib/events/lifecycle';
import { LiveValue } from '@/features/display/Display';
import {
  Action,
  Facts,
  PageHeading,
  Panel,
  Pagination,
  StateNotice,
  ui,
} from '@/features/ui/Ui';
import { EventsData } from './data';
import {
  EVENT_PAGE_SIZE,
  eventHref,
  orderEventDirectory,
  pageNumber,
} from './model';
import { EventCard } from './EventCard';
import { EventRecord } from './EventRecord';
import styles from './events.module.css';
export function Events() {
  const params = useSearchParams();
  return (
    <>
      <PageHeading title="이벤트" />
      <EventsData>
        {(events, now) => {
          const ordered = orderEventDirectory(events, now);
          const totalPages = Math.ceil(ordered.length / EVENT_PAGE_SIZE);
          const page = Math.min(
            pageNumber(params.get('page')),
            Math.max(1, totalPages),
          );

          return (
            <div className={styles.directory}>
              <div>
                {ordered.length ? (
                  <div className={styles.cards}>
                    {ordered
                      .slice(
                        (page - 1) * EVENT_PAGE_SIZE,
                        page * EVENT_PAGE_SIZE,
                      )
                      .map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          focused={params.get('focus') === event.id}
                        />
                      ))}
                  </div>
                ) : (
                  <StateNotice title="공개된 행사가 아직 없습니다">
                    <Action href="/signal">다음 행사 소식 신청</Action>
                  </StateNotice>
                )}
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  href={(page) => `/events?page=${page}`}
                />
              </div>
              <EventSummary events={events} now={now} />
            </div>
          );
        }}
      </EventsData>
    </>
  );
}
export function EventDetail({ eventId }: { eventId: string }) {
  return (
    <EventsData>
      {(events, now) => {
        const event = events.find((event) => event.id === eventId);
        if (!event)
          return (
            <>
              <PageHeading title="행사를 찾을 수 없습니다" />
              <StateNotice error title="공개된 행사 기록이 없습니다">
                <Action href="/events">행사 목록으로</Action>
              </StateNotice>
            </>
          );
        return (
          <>
            <PageHeading title={event.session} />
            <EventRecord event={event} events={events} now={now} />
          </>
        );
      }}
    </EventsData>
  );
}

function EventSlots({ active }: { active: boolean }) {
  return (
    <div
      data-readout-instrument=""
      className={styles.eventSlots}
      data-active={active}
      aria-hidden="true"
    >
      {Array.from({ length: 24 }, (_, index) => (
        <i
          key={index}
          data-dim={[2, 4, 10, 13, 19, 22].includes(index)}
          data-accent={index === 7 || index === 8}
          style={{ animationDelay: `${(index % 4) * -0.7}s` }}
        />
      ))}
    </div>
  );
}

function EventSummary({ events, now }: { events: TerminalEvent[]; now: Date }) {
  const live = getLiveEvents(events, now);
  const upcoming = events.filter((event) => event.status === 'UPCOMING');
  const archived = getArchivedOrElapsedEvents(events, now);
  const next = getFutureUpcomingEvent(events, now);
  return (
    <Panel
      title="이벤트 현황"
      code={`${events.length} EVENTS`}
      className={styles.directorySummary}
    >
      <Facts
        rows={[
          ['진행 중', <LiveValue key="live" value={live.length} />],
          ['예정', <LiveValue key="upcoming" value={upcoming.length} />],
          ['지난 행사', <LiveValue key="archived" value={archived.length} />],
        ]}
      />
      <EventSlots active={!!next || live.length > 0} />
      {next && (
        <div className={styles.nextEvent}>
          <p>다음 행사</p>
          <Link href={eventHref(next.id)}>{next.session}</Link>
          <p>
            {next.date} · {next.venue}
          </p>
        </div>
      )}
      <div className={ui.actions}>
        <Action href="/signal">다음 행사 소식 신청</Action>
      </div>
    </Panel>
  );
}
