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
import { Barcode, Corners } from '@/features/display/Instruments';
import { Decode } from '@/features/display/Decode';
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
          {event.status === 'ARCHIVED' && (
            <p className={styles.noUpcoming}>다음 행사 미정</p>
          )}
          <Corners crosses />
          <h2 aria-label={event.session}>
            <span aria-hidden="true"><Decode text={event.session} duration={640} /></span>
          </h2>
          <p className={styles.subtitle}>
            {event.subtitle}
          </p>
          <EventCountdown event={event} />
          <div className={styles.sweep}>
            <Blocks
              cols={20}
              motion="scan"
              step={1000}
              tone={event.status === 'ARCHIVED' ? 'ice' : 'amber'}
            />
            <Barcode value={event.id} className={styles.featuredCode} />
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
