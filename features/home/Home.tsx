'use client';
import Link from 'next/link';
import {
  getDefaultEvent,
  getFutureUpcomingEvent,
} from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { Feed } from '@/features/transmit/Feed';
import { Action, PageHeading, Panel } from '@/features/ui/Ui';
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
              <div className={styles.column}>
                <Panel title="최근 방문자 로그" label="LOG" className={styles.recent}>
                  <Feed limit={3} />
                  <div className={styles.columnActions}>
                    <Action href="/transmit">방문자 로그 전체</Action>
                  </div>
                </Panel>
                <Link href="/signal" className={styles.signalTile} data-surface="cyan">
                  <span className={styles.tileLabel} aria-hidden="true">SIGNAL</span>
                  <span className={styles.tileText}>다음 행사 소식 받기</span>
                  <span className={styles.tileCode} aria-hidden="true">MAIL / INSTAGRAM →</span>
                </Link>
              </div>
            </div>
          );
        }}
      </EventsData>
    </>
  );
}
