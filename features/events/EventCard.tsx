'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, publicArtists, statusLabel } from './model';
import styles from './events.module.css';

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
      data-readout-panel=""
      data-event-state={event.status}
      className={styles.card}
      href={eventHref(event.id)}
    >
      <div className={styles.cardHeader}>
        <div>
          <small>
            {event.id} / {event.date}
          </small>
          <h2>{event.session}</h2>
        </div>
        <span className={styles.recordStamp}>
          <i aria-hidden="true" />
          {statusLabel(event.status)}
        </span>
      </div>
      {event.subtitle && <p>{event.subtitle}</p>}
      <p>
        {event.venue} · {event.time.replace(' KST', '')} KST
      </p>
      {artists.length ? (
        <ul className={styles.cardArtists}>
          {artists.map((artist) => (
            <li key={artist.id}>{artist.name}</li>
          ))}
        </ul>
      ) : (
        <div className={styles.cardBlank} aria-hidden="true" />
      )}
      <div className={styles.cardFooter}>
        <span>
          {event.status === 'ARCHIVED' ? '전체 행사 기록' : '행사 상세 보기'}
        </span>
        <span className={styles.cardSignal} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </Link>
  );
}
