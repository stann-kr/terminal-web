import type { TerminalEvent } from '@/lib/events/types';
import {
  eventHref,
  paragraphs,
  publicArtists,
  statusLabel,
} from '@/features/events/model';
import { Action, Facts, FullText, StateNotice } from '@/features/ui/Ui';
import { SignalText } from '@/features/display/Display';
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
      data-readout-panel=""
      className={styles.featured}
      aria-label="대표 행사"
    >
      {event ? (
        <>
          <div data-readout-row="" className={styles.recordHeader}>
            <SignalText active={event.status !== 'ARCHIVED'}>
              {statusLabel(event.status)}
            </SignalText>
            <span>{event.id}</span>
          </div>
          {event.status === 'ARCHIVED' && (
            <p className={styles.noUpcoming}>다음 행사 미정</p>
          )}
          <h2 data-readout-row="">{event.session}</h2>
          <p data-readout-row="" className={styles.subtitle}>
            {event.subtitle}
          </p>
          <EventCountdown event={event} />
          <div
            data-readout-instrument=""
            className={styles.homeRelay}
            aria-hidden="true"
            data-active={event.status !== 'ARCHIVED'}
          >
            {[0, 1].map((bank) => (
              <span key={bank}>
                {Array.from({ length: 5 }, (_, index) => (
                  <i key={index} />
                ))}
              </span>
            ))}
          </div>
          <Facts
            rows={[
              [
                '일시 / KST',
                `${event.date} · ${event.time.replace(' KST', '')}`,
              ],
              ['장소', event.venue],
            ]}
          />
          <ul className={styles.names}>
            {publicArtists(event).map((artist) => (
              <li key={artist.id}>{artist.name}</li>
            ))}
          </ul>
          <FullText
            language={language}
            paragraphs={paragraphs(event.description, language)}
          />
          <div className={styles.columnActions}>
            <Action primary href={eventHref(event.id)}>
              행사 상세 보기
            </Action>
            <Action href="/signal">소식 신청</Action>
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
