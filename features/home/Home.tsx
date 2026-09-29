'use client';
import {
  getDefaultEvent,
  getFutureUpcomingEvent,
} from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { Feed } from '@/features/transmit/Feed';
import { Action, PageHeading, Panel } from '@/features/ui/Ui';
import { Plate } from '@/features/display/Plate';
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
              <div className={styles.column}>
                <HomeIndex events={events} />
                <Plate title="Seoul node" code={'T-03 INTERFACE\nKST +09:00'} cross className={styles.fill} />
              </div>
              <FeaturedEvent event={event} language={language} />
              <div className={styles.column}>
                <Panel title="최근 방문자 로그" code="LOG 04" className={styles.recent}>
                  <Feed limit={3} />
                  <div className={styles.columnActions}>
                    <Action href="/transmit">방문자 로그 전체</Action>
                  </div>
                </Panel>
                <Plate surface="teal" title="Signal ch.01" code={'NEXT SESSION NOTICE\nMAIL / INSTAGRAM'} className={styles.fill} />
                <Plate hatch code="RESERVED BAY" className={styles.hatch} />
              </div>
            </div>
          );
        }}
      </EventsData>
    </>
  );
}
