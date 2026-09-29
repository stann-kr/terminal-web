'use client';
import Link from 'next/link';
import {
  getDefaultEvent,
  getFutureUpcomingEvent,
} from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { Feed } from '@/features/transmit/Feed';
import { Action, Chip, PageHeading, Panel } from '@/features/ui/Ui';
import { Mark } from '@/features/display/Mark';
import { HomeIndex } from './HomeIndex';
import { HomeRoster, HomeStatus } from './HomeModules';
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
            <div className={styles.wall}>
              <FeaturedEvent event={event} language={language} />
              <HomeIndex events={events} />
              <HomeStatus events={events} />
              <HomeRoster events={events} />
              <Panel title="최근 방문자 로그" label="Transmissions" surface="cream" className={styles.log}>
                <Feed limit={3} />
                <div className={styles.plateActions}>
                  <Action href="/transmit">방문자 로그 전체</Action>
                </div>
              </Panel>
              <Link href="/signal" className={styles.signal} data-surface="peach">
                <span className={styles.signalHead} aria-hidden="true">
                  <b>SIGNAL</b>
                  <Mark className={styles.signalMark} />
                </span>
                <span className={styles.signalText}>다음 행사 소식 받기</span>
                <span className={styles.signalChips} aria-hidden="true">
                  <Chip>CH 01</Chip>
                  <Chip>MAIL</Chip>
                  <Chip>INSTAGRAM</Chip>
                </span>
              </Link>
            </div>
          );
        }}
      </EventsData>
    </>
  );
}
