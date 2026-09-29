'use client';
import Link from 'next/link';
import {
  getDefaultEvent,
  getFutureUpcomingEvent,
} from '@/lib/events/lifecycle';
import { EventsData } from '@/features/events/data';
import { useLanguage } from '@/features/shell/Providers';
import { NodeActivity } from '@/features/transmit/NodeActivity';
import { Action, ActionDeck, Chip, PageHeading, Panel } from '@/features/ui/Ui';
import { HomeIndex } from './HomeIndex';
import { HomeRoster, HomeStatus } from './HomeModules';
import { FeaturedEvent } from './FeaturedEvent';
import styles from './home.module.css';
export function Home() {
  const { language } = useLanguage();
  return (
    <>
      <PageHeading title="TERMINAL 홈" />
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
              <div className={`${styles.stack} ${styles.log}`}>
                <Panel title="최근 접속 기록" label="Node activity">
                  <NodeActivity limit={6} />
                </Panel>
                <ActionDeck label="LOG">
                  <Action href="/transmit">방문자 로그</Action>
                </ActionDeck>
              </div>
              <Link href="/signal" className={styles.signal} data-surface="red">
                <span className={styles.signalHead} aria-hidden="true">
                  <b>SIGNAL</b>
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
