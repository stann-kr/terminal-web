import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { publicArtists } from '@/features/events/model';
import { buildArtistArchive } from '@/features/artists/model';
import { Action, Panel } from '@/features/ui/Ui';
import { LiveValue, SignalText } from '@/features/display/Display';
import { Blocks } from '@/features/display/Blocks';
import { Ticks } from '@/features/display/Instruments';
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
              <Blocks
                cols={12}
                motion="still"
                tone={status === 'ARCHIVED' ? 'ice' : 'amber'}
                lit={Array.from(
                  { length: events.length ? Math.round((count / events.length) * 12) : 0 },
                  (_, index) => index,
                )}
                className={styles.statusTrack}
              />
              <span>
                {count}/{events.length}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.register}>
        <Blocks
          cols={12}
          rows={2}
          lit={[1, 4, 5, 9, 13, 14, 18, 22]}
          accent={events.some((event) => event.status !== 'ARCHIVED') ? [6] : []}
        />
        <Ticks count={24} major={6} labels />
      </div>
      <div className={styles.intro}>
        <p>
          음악이 시작되고
          <br />
          사람이 모이는 곳.
        </p>
      </div>
      <div className={styles.columnActions}>
        <Action href="/about">TERMINAL 소개</Action>
      </div>
    </Panel>
  );
}
