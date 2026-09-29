'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { Blocks } from '@/features/display/Blocks';
import { eventHref, publicArtists, statusLabel } from './model';
import styles from './events.module.css';

/** One directory row: ID, session, time, venue and state; the lineup is its second line. */
export function EventCard({
  event,
  focused,
}: {
  event: TerminalEvent;
  focused: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const artists = publicArtists(event);
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ block: 'nearest' });
    ref.current?.focus({ preventScroll: true });
  }, [focused]);
  return (
    <Link
      ref={ref}
      data-event-state={event.status}
      className={styles.card}
      href={eventHref(event.id)}
    >
      <span className={styles.cardId}>{event.id}</span>
      <div className={styles.cardMain}>
        <h2>{event.session}</h2>
        {event.subtitle && <span className={styles.cardSubtitle}>{event.subtitle}</span>}
        {artists.length > 0 && (
          <span className={styles.cardArtists}>
            <span className={styles.srOnly}>출연 </span>
            {artists.map(artist => artist.name).join(' · ')}
          </span>
        )}
      </div>
      <span className={styles.cardWhen}>
        {event.date}
        <small>{event.time.replace(' KST', '')} KST</small>
      </span>
      <span className={styles.cardVenue}>{event.venue}</span>
      <span className={styles.recordStamp}>
        <span className={styles.stateChip}>{statusLabel(event.status)}</span>
        <Blocks
          cols={4}
          motion={event.status === 'ARCHIVED' ? 'still' : 'scan'}
          step={140}
          tone={event.status === 'ARCHIVED' ? 'mint' : 'sand'}
          lit={event.status === 'ARCHIVED' ? [0, 1] : []}
          className={styles.cardLamp}
        />
      </span>
    </Link>
  );
}
