import type { TerminalEvent } from '@/lib/events/types';
import {
  eventHref,
  paragraphs,
  publicArtists,
  statusLabel,
} from '@/features/events/model';
import { Action, ActionDeck, Bay, Chip, BrandText, Facts, FullText, StateNotice, Sub } from '@/features/ui/Ui';
import { EventCountdown } from './EventCountdown';
import styles from './home.module.css';

/** The featured session plate: sand while upcoming, peach while live, sage once archived. */
export function FeaturedEvent({
  event,
  language,
}: {
  event: TerminalEvent | null;
  language: 'ko' | 'en';
}) {
  const artists = event ? publicArtists(event) : [];
  return (
    <div className={`${styles.stack} ${styles.next}`}>
    <section
      className={styles.featured}
      aria-label="대표 행사"
      data-surface={!event || event.status === 'ARCHIVED' ? 'cream' : event.status === 'LIVE' ? 'red' : 'orange'}
    >
      <i className={styles.pulse} aria-hidden="true" />
      <header className={styles.featuredHead}>
        <p className={styles.featuredLabel} aria-hidden="true">
          {event?.status === 'ARCHIVED' ? 'Last session' : 'Next session'}
        </p>
        {event && (
          <span className={styles.featuredChips}>
            <Chip solid>{statusLabel(event.status)}</Chip>
            <Chip>{event.id}</Chip>
          </span>
        )}
      </header>
      {event ? (
        <>
          {event.status === 'ARCHIVED' && (
            <p className={styles.noUpcoming}>다음 행사 미정</p>
          )}
          <h2 className={styles.session}><BrandText text={event.session} /></h2>
          <p className={styles.subtitle}>{event.subtitle}</p>
          <div className={styles.featuredGrid}>
            <EventCountdown event={event} />
            <div>
              <Sub>Schedule</Sub>
              <Facts
                rows={[
                  ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
                  ['장소', event.venue],
                  ['지역', event.district],
                ]}
              />
            </div>
          </div>
          <Sub>Lineup</Sub>
          <ul className={styles.lineupCells}>
            {artists.length
              ? artists.map((artist) => (
                  <li key={artist.id}>
                    <b>{artist.name}</b>
                    <small aria-hidden="true">{artist.dock ? `STAGE ${artist.dock}` : 'STAGE TBA'}</small>
                  </li>
                ))
              : Array.from({ length: 4 }, (_, index) => (
                  <li key={index} data-empty="">
                    <b>{index === 0 ? '공개 전' : '----'}</b>
                    <small aria-hidden="true">TBA</small>
                  </li>
                ))}
          </ul>
          {paragraphs(event.description, language).length > 0 && (
            <>
              <Sub>Briefing</Sub>
              <FullText language={language} paragraphs={paragraphs(event.description, language)} />
            </>
          )}
          <Bay label={`${event.id} / SESSION FILE`} />
        </>
      ) : (
        <StateNotice title="공개된 행사가 아직 없습니다">
          <div className={styles.featuredActions}>
            <Action href="/signal">소식 신청</Action>
            <Action href="/about">소개</Action>
          </div>
        </StateNotice>
      )}
    </section>
    {event && (
      <ActionDeck label="SESSION">
        <Action primary href={eventHref(event.id)}>
          행사 상세 보기
        </Action>
        <Action href="/signal">소식 신청</Action>
      </ActionDeck>
    )}
    </div>
  );
}
