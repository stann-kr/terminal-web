'use client';
import {
  getDefaultEvent,
  getFutureUpcomingEvent,
} from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { PageHeading } from '@/features/ui/Ui';
import { HomeIndex } from './HomeIndex';
import { FeaturedEvent } from './FeaturedEvent';
import styles from './home.module.css';
export function Home() {
  const { language } = useLanguage();
  return (
    <>
      <PageHeading title="음악과 사람, 이어지는 기록" />
      <EventsData>
        {(events, now) => {
          const event =
            getFutureUpcomingEvent(events, now) ?? getDefaultEvent(events, now);

          return (
            <div className={styles.dashboard}>
              <HomeIndex events={events} />
              <FeaturedEvent event={event} language={language} />
            </div>
          );
        }}
      </EventsData>
    </>
  );
}
