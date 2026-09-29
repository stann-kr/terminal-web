import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { publicArtists } from '@/features/events/model';
import { buildArtistArchive } from '@/features/artists/model';
import { Action, Panel } from '@/features/ui/Ui';
import { LiveValue, SignalText } from '@/features/display/Display';
import styles from './home.module.css';

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
  return (
    <Panel title="축적된 기록" code="INDEX" className={styles.index}>
      <ul className={styles.stats}>
        {stats.map(([href, label, count]) => (
          <li key={label}>
            <Link href={href}>
              <span>{label}</span>
              <strong>
                <LiveValue value={String(count).padStart(2, '0')} />
              </strong>
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.statusMix}>
        <p className={styles.smallHeading}>EVENT STATUS / 전체 행사</p>
        {(['LIVE', 'UPCOMING', 'ARCHIVED'] as const).map((status) => {
          const count = events.filter(
            (event) => event.status === status,
          ).length;
          return (
            <div key={status}>
              <SignalText active={count > 0 && status !== 'ARCHIVED'}>
                {status}
              </SignalText>
              <span className={styles.statusTrack} aria-hidden="true">
                <i
                  data-readout-meter=""
                  style={{
                    width: `${events.length ? (count / events.length) * 100 : 0}%`,
                  }}
                />
              </span>
              <span>
                {count}/{events.length}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.intro}>
        <p data-readout-row="">
          음악이 시작되고
          <br />
          사람이 모이는 곳.
        </p>
      </div>
      <div
        data-readout-instrument=""
        className={styles.homeRegister}
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className={styles.columnActions}>
        <Action href="/about">TERMINAL 소개</Action>
      </div>
    </Panel>
  );
}
