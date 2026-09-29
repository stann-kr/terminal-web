'use client';
import { useSearchParams } from 'next/navigation';
import { EventsData } from '@/features/events/data';
import { pageNumber } from '@/features/events/model';
import { Bay, PageHeading, Pagination, Panel, StateNotice } from '@/features/ui/Ui';
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
            <Panel
              heading={false}
              title="함께한 아티스트"
              label="ARTIST ROSTER"
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
          );
        }}
      </EventsData>
    </>
  );
}

export { ArtistDetail } from './ArtistDetail';
