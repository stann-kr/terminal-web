import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { publicArtists } from '@/features/events/model';
import { buildArtistArchive } from '@/features/artists/model';
import { Action, Panel } from '@/features/ui/Ui';
import { LiveValue } from '@/features/display/Display';
import { Meter } from '@/features/display/Meter';
import styles from './home.module.css';

export function HomeIndex({ events }: { events: TerminalEvent[] }) {
  const archived = events.filter((event) => event.status === 'ARCHIVED');
  const profiles = buildArtistArchive(events);
  const fullyMapped = profiles.every((profile) => profile.verified);
  const stats = [
    ['/events', 'EV-A', '전체 행사', events.length],
    ['/events', 'EV-R', '지난 행사', archived.length],
    [
      '/artists',
      'AR-P',
      fullyMapped ? '공개 아티스트' : '공개 출연 기록',
      fullyMapped
        ? profiles.length
        : events.reduce(
            (count, event) => count + publicArtists(event).length,
            0,
          ),
    ],
  ] as const;
  return (
    <Panel title="축적된 기록" label="INDEX" className={styles.index}>
      <ul className={styles.stats}>
        {stats.map(([href, code, label, count]) => (
          <li key={label}>
            <Link href={href}>
              <span className={styles.statCode} aria-hidden="true">{code}</span>
              <strong>
                <LiveValue value={String(count).padStart(4, '0')} />
              </strong>
              <span className={styles.statLabel}>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.statusMix}>
        <p className={styles.smallHeading}>EVENT STATUS</p>
        {(['LIVE', 'UPCOMING', 'ARCHIVED'] as const).map((status) => {
          const count = events.filter(
            (event) => event.status === status,
          ).length;
          return (
            <div key={status} data-status={status}>
              <span className={styles.statusName}>{status}</span>
              <Meter
                segments={10}
                value={events.length ? (count / events.length) * 10 : 0}
                tone={status === 'LIVE' ? 'cyan' : status === 'UPCOMING' ? 'sand' : 'mint'}
              />
              <span className={styles.statusCount}>
                {count}/{events.length}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.intro}>
        음악이 시작되고
        <br />
        사람이 모이는 곳.
      </p>
      <div className={styles.columnActions}>
        <Action href="/about">TERMINAL 소개</Action>
      </div>
    </Panel>
  );
}
