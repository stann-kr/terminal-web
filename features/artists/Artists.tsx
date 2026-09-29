'use client';
import { useSearchParams } from 'next/navigation';
import { EventsData } from '@/features/events/data';
import { pageNumber } from '@/features/events/model';
import { PageHeading, Pagination, StateNotice } from '@/features/ui/Ui';
import { buildArtistArchive } from './model';
import { ArtistCard } from './ArtistCard';
import styles from './artists.module.css';

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
            <>
              <p className={styles.count}>
                {profiles.length}개 기록
              </p>
              {profiles.length ? (
                <div className={styles.grid}>
                  {profiles.slice((page - 1) * 12, page * 12).map((profile) => (
                    <ArtistCard key={profile.key} profile={profile} />
                  ))}
                </div>
              ) : (
                <StateNotice title="아직 공개된 아티스트 기록이 없습니다" />
              )}
              <Pagination
                page={page}
                totalPages={totalPages}
                href={(page) => `/artists?page=${page}`}
              />
            </>
          );
        }}
      </EventsData>
    </>
  );
}

export { ArtistDetail } from './ArtistDetail';
