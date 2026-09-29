'use client';
import { useSearchParams } from 'next/navigation';
import { EventsData } from '@/features/events/data';
import { pageNumber } from '@/features/events/model';
import { Bay, Facts, PageHeading, Pagination, Panel, StateNotice } from '@/features/ui/Ui';
import { buildArtistArchive } from './model';
import { ArtistCard, EmptyCell } from './ArtistCard';
import styles from './artists.module.css';

/** For each empty slot, the grid widths (3, 4 or 6 columns) whose last row it completes. */
function emptySlots(count: number) {
  const need = (columns: number) => (columns - (count % columns)) % columns;
  return Array.from({ length: Math.max(need(3), need(4), need(6)) }, (_, index) =>
    [3, 4, 6].filter((columns) => index < need(columns)).join(' '),
  );
}

/** Side plates: real counts by origin and by appearance, printed as label/value rows. */
function RosterSummary({ profiles }: { profiles: ReturnType<typeof buildArtistArchive> }) {
  const origins = [...new Set(profiles.map((profile) => profile.origin || '—'))].sort();
  const appearances = profiles.reduce((count, profile) => count + profile.appearances.length, 0);
  const sessions = new Set(profiles.flatMap((profile) => profile.appearances.map((row) => row.event.id))).size;
  return (
    <div className={styles.side}>
      <Panel title="명부 집계" label="Register" surface="cream">
        <Facts
          rows={[
            ['아티스트', String(profiles.length).padStart(3, '0')],
            ['출연 기록', String(appearances).padStart(3, '0')],
            ['참여 세션', String(sessions).padStart(3, '0')],
          ]}
        />
      </Panel>
      <Panel title="출신" label="Origin" surface="navy" className={styles.origins}>
        <ul className={styles.originCells}>
          {origins.map((origin) => (
            <li key={origin}>
              <b>{origin}</b>
              <span>{profiles.filter((profile) => (profile.origin || '—') === origin).length} FILES</span>
            </li>
          ))}
        </ul>
        <Bay label="ROSTER / SEOUL" />
      </Panel>
    </div>
  );
}

export function Artists() {
  const params = useSearchParams();
  return (
    <>
      <PageHeading title="함께한 아티스트" />
      <EventsData>
        {(events) => {
          const profiles = buildArtistArchive(events).sort(
            (a, b) =>
              a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key),
          );
          const totalPages = Math.ceil(profiles.length / 12),
            page = Math.min(
              pageNumber(params.get('page')),
              Math.max(totalPages, 1),
            );
          return (
            <div className={styles.layout}>
              <Panel
                heading={false}
                title="함께한 아티스트"
                label="Artist roster"
                surface="navy"
                code={`${String(profiles.length).padStart(3, '0')} FILES`}
                className={styles.roster}
              >
                <p className={styles.count}>{profiles.length}개 기록</p>
                {profiles.length ? (
                  <div className={styles.grid}>
                    {profiles.slice((page - 1) * 12, page * 12).map((profile) => (
                      <ArtistCard key={profile.key} profile={profile} />
                    ))}
                    {emptySlots(profiles.slice((page - 1) * 12, page * 12).length).map((fills, index) => (
                      <EmptyCell key={index} fills={fills} />
                    ))}
                  </div>
                ) : (
                  <StateNotice title="아직 공개된 아티스트 기록이 없습니다" />
                )}
                <Bay label="END OF ROSTER" />
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  href={(page) => `/artists?page=${page}`}
                />
              </Panel>
              <RosterSummary profiles={profiles} />
            </div>
          );
        }}
      </EventsData>
    </>
  );
}

export { ArtistDetail } from './ArtistDetail';
