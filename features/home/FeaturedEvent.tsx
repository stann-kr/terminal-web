import type { TerminalEvent } from '@/lib/events/types';
import {
  eventHref,
  paragraphs,
  publicArtists,
  statusLabel,
} from '@/features/events/model';
import { Action, Facts, FullText, StateNotice } from '@/features/ui/Ui';
import { SignalText } from '@/features/display/Display';
import { Blocks } from '@/features/display/Blocks';
import { EventCountdown } from './EventCountdown';
import styles from './home.module.css';

export function FeaturedEvent({
  event,
  language,
}: {
  event: TerminalEvent | null;
  language: 'ko' | 'en';
}) {
  return (
    <section
      className={styles.featured}
      aria-label="대표 행사"
      data-surface={!event ? undefined : event.status === 'ARCHIVED' ? 'mint' : event.status === 'LIVE' ? 'teal' : 'sand'}
    >
      {event ? (
        <>
          <div className={styles.recordHeader}>
            <SignalText active={event.status !== 'ARCHIVED'}>
              {statusLabel(event.status)}
            </SignalText>
            <span className={styles.recordRole}>
              {event.status === 'ARCHIVED' ? 'LAST SESSION' : 'NEXT SESSION'}
            </span>
            <span className={styles.recordId}>{event.id}</span>
          </div>
          <div className={styles.featuredBody}>
            <div className={styles.hero}>
              {event.status === 'ARCHIVED' && (
                <p className={styles.noUpcoming}>다음 행사 미정</p>
              )}
              <h2>{event.session}</h2>
              <p className={styles.subtitle}>{event.subtitle}</p>
              <EventCountdown event={event} />
              <div className={styles.sweep} aria-hidden="true">
                <Blocks cols={20} motion="scan" step={1000} />
                <span className={styles.featuredCode}>{event.id}</span>
              </div>
            </div>
            <div className={styles.dossier}>
              <Facts
                rows={[
                  [
                    '일시 / KST',
                    `${event.date} · ${event.time.replace(' KST', '')}`,
                  ],
                  ['장소', event.venue],
                ]}
              />
              {publicArtists(event).length > 0 && (
                <div className={styles.lineup}>
                  <p className={styles.lineupLabel}>LINEUP</p>
                  <ul className={styles.names}>
                    {publicArtists(event).map((artist) => (
                      <li key={artist.id}>{artist.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              <FullText
                language={language}
                paragraphs={paragraphs(event.description, language)}
              />
            </div>
          </div>
          <div className={styles.featuredActions}>
            <Action primary href={eventHref(event.id)}>
              행사 상세 보기
            </Action>
            <Action href="/signal">소식 신청</Action>
            <span className={styles.actionHatch} aria-hidden="true" />
          </div>
        </>
      ) : (
        <StateNotice title="공개된 행사가 아직 없습니다">
          <div className={styles.columnActions}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      )}
    </section>
  );
}
