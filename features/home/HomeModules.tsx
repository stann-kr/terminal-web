import Link from 'next/link';
import type { TerminalEvent } from '@/lib/events/types';
import { artistHref, buildArtistArchive } from '@/features/artists/model';
import { Action, Chip, Panel } from '@/features/ui/Ui';
import { Meter } from '@/features/display/Meter';
import styles from './home.module.css';

/** Status plate: one row per lifecycle state with a real share meter, like a fault board. */
export function HomeStatus({ events }: { events: TerminalEvent[] }) {
  const pending = events.some((event) => event.status !== 'ARCHIVED');
  return (
    <Panel title="행사 상태" label="Status" surface="gold" className={styles.status}>
      <ul className={styles.statusRows}>
        {(['LIVE', 'UPCOMING', 'ARCHIVED'] as const).map((status, index) => {
          const count = events.filter((event) => event.status === status).length;
          return (
            <li key={status}>
              <span className={styles.statusIndex} aria-hidden="true">D{index + 1}</span>
              <span className={styles.statusName}>{status}</span>
              <Meter segments={6} value={events.length ? (count / events.length) * 6 : 0} />
              <span className={styles.statusCount}>{count}</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.statusLine}>
        <Chip solid>{pending ? 'SESSION PENDING' : 'ALL SESSIONS LOGGED'}</Chip>
      </p>
      <div className={styles.plateActions}>
        <Action href="/about">TERMINAL 소개</Action>
      </div>
    </Panel>
  );
}

/** Roster plate: every public artist as a small code cell; the canonical STANN LUMO is the signal cell. */
export function HomeRoster({ events }: { events: TerminalEvent[] }) {
  const profiles = buildArtistArchive(events).sort(
    (a, b) => a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key),
  );
  return (
    <Panel
      title="공개 아티스트"
      label="Artist roster"
      code={`${String(profiles.length).padStart(3, '0')} FILES`}
      surface="navy"
      className={styles.roster}
    >
      {profiles.length ? (
        <ul className={styles.rosterCells}>
          {profiles.slice(0, 12).map((profile) => (
            <li key={profile.key}>
              <Link
                href={artistHref(profile.key)}
                data-featured={profile.key === 'stann-lumo' || undefined}
                data-upcoming={profile.appearances.some((row) => row.event.status !== 'ARCHIVED') || undefined}
              >
                <span className={styles.rosterName}>{profile.name}</span>
                <span className={styles.rosterMeta} aria-hidden="true">
                  {profile.origin} · {String(profile.appearances.length).padStart(2, '0')} REC
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>공개된 아티스트 기록이 아직 없습니다.</p>
      )}
      <div className={styles.plateActions}>
        <Action href="/artists">전체 아티스트</Action>
      </div>
    </Panel>
  );
}
