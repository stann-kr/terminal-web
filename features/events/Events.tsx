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
import { Blocks } from '@/features/display/Blocks';
import { Ticks } from '@/features/display/Instruments';
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
                    <p className={styles.cardsHead} aria-hidden="true">
                      <span>ID</span>
                      <span>SESSION</span>
                      <span>DATE / KST</span>
                      <span>VENUE</span>
                      <span>STATE</span>
                    </p>
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
      <div className={styles.bays}>
        <Blocks
          cols={6}
          rows={4}
          step={110}
          lit={[0, 1, 3, 5, 6, 9, 11, 12, 14, 15, 16, 18, 20, 21, 23]}
          accent={next || live.length > 0 ? [7, 8] : []}
        />
        <Ticks count={30} major={5} marker />
      </div>
      {next && (
        <div className={styles.nextEvent}>
          <p>NEXT / 다음 행사</p>
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
