import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, publicArtists, statusLabel } from '@/features/events/model';
import { buildArtistArchive } from '@/features/artists/model';
import { Panel, Sub } from '@/features/ui/Ui';
import { LiveValue } from '@/features/display/Display';
import styles from './home.module.css';

/** Session archive plate: counters as label/value rows, then one code cell per session. */
export function HomeIndex({ events }: { events: TerminalEvent[] }) {
  const archived = events.filter((event) => event.status === 'ARCHIVED');
  const profiles = buildArtistArchive(events);
  const fullyMapped = profiles.every((profile) => profile.verified);
  const stats = [
    ['/events', '전체 행사', events.length],
    ['/events', '지난 행사', archived.length],
    [
      '/artists',
      fullyMapped ? '공개 아티스트' : '공개 출연 기록',
      fullyMapped
        ? profiles.length
        : events.reduce(
            (count, event) => count + publicArtists(event).length,
            0,
          ),
    ],
  ] as const;
  const sessions = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel title="축적된 기록" label="Session archive" surface="sage" className={styles.archive}>
      <ul className={styles.counters}>
        {stats.map(([href, label, count]) => (
          <li key={label}>
            <Link href={href}>
              <span>{label}</span>
              <strong>
                <LiveValue value={String(count).padStart(3, '0')} />
              </strong>
            </Link>
          </li>
        ))}
      </ul>
      {sessions.length > 0 && (
        <>
          <Sub>Sessions</Sub>
          <ul className={styles.sessions}>
            {sessions.map((event) => (
              <li key={event.id}>
                <Link href={eventHref(event.id)} data-state={event.status}>
                  <span className={styles.sessionCode} aria-hidden="true">
                    {event.id.replace(/\D+/g, '').padStart(2, '0') || event.id}
                  </span>
                  <span className={styles.sessionName}>{event.session}</span>
                  <span className={styles.sessionState}>{statusLabel(event.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
