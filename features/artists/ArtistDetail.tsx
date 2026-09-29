'use client';
import Link from 'next/link';
import { EventsData } from '@/features/events/data';
import { eventHref, paragraphs, statusLabel } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import {
  Action,
  FullText,
  PageHeading,
  Panel,
  StateNotice,
  ui,
} from '@/features/ui/Ui';
import { buildArtistArchive, type ArtistProfile } from './model';
import { Blocks } from '@/features/display/Blocks';
import { Barcode, Corners } from '@/features/display/Instruments';
import { Decode } from '@/features/display/Decode';
import styles from './artists.module.css';

export function ArtistDetail({ artistKey }: { artistKey: string }) {
  const { language } = useLanguage();
  return (
    <EventsData>
      {(events) => {
        const profile = buildArtistArchive(events).find(
          (profile) => profile.key === artistKey,
        );
        if (!profile)
          return (
            <>
              <PageHeading title="아티스트 기록을 찾을 수 없습니다" />
              <StateNotice error title="공개된 출연 이력이 없습니다">
                <Action href="/artists">전체 아티스트 보기</Action>
              </StateNotice>
            </>
          );

        return (
          <>
            <PageHeading title={profile.name} />
            <div className={styles.detail}>
              <ArtistProfileSummary profile={profile} />
              <ArtistChronology profile={profile} language={language} />
              <ArtistBiography profile={profile} language={language} />
            </div>
          </>
        );
      }}
    </EventsData>
  );
}

function ArtistProfileSummary({ profile }: { profile: ArtistProfile }) {
  return (
    <Panel title="프로필" code="PROFILE">
      <div className={styles.profileSignal} aria-hidden="true">
        <p className={styles.profileHead}>
          <span>ARTIST FILE</span>
          <span>{profile.origin}</span>
        </p>
        <strong className={styles.profileName}><Decode text={profile.name} duration={640} /></strong>
        <div className={styles.profileFoot}>
          <Blocks cols={14} step={110} lit={[2, 3, 7, 11]} accent={[12]} />
          <Barcode value={profile.key} />
        </div>
        <Corners crosses />
      </div>
      <div className={ui.actions}>
        <Action href="/artists">전체 아티스트</Action>
      </div>
    </Panel>
  );
}

function ArtistChronology({
  profile,
  language,
}: {
  profile: ArtistProfile;
  language: 'ko' | 'en';
}) {
  return (
    <Panel title="출연 기록" code="RECORDS" className={styles.chronology}>
      <ol className={styles.timeline}>
        {profile.appearances.map(({ event, artist }) => (
          <li key={`${event.id}:${artist.id}`}>
            <time dateTime={event.date}>{event.date}</time>
            <div>
              <span className={styles.state}>{statusLabel(event.status)}</span>
              <Link href={eventHref(event.id)}>{event.session}</Link>
              <p>
                {event.venue} · {artist.dock} · {artist.time}
              </p>
              <details>
                <summary>당시 아티스트 소개</summary>
                <FullText
                  language={language}
                  excerpt={false}
                  paragraphs={paragraphs(artist.description, language)}
                />
              </details>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ArtistBiography({
  profile,
  language,
}: {
  profile: ArtistProfile;
  language: 'ko' | 'en';
}) {
  const biography = profile.appearances.find(
    (row) => paragraphs(row.artist.description, language).length,
  );
  return (
    <Panel title="소개" code={language.toUpperCase()}>
      <FullText
        language={language}
        excerpt={false}
        paragraphs={paragraphs(biography?.artist.description, language)}
      />
      {biography && (
        <p className={styles.note}>
          출처:{' '}
          <Link href={eventHref(biography.event.id)}>
            {biography.event.session} / {biography.event.date}
          </Link>
        </p>
      )}
    </Panel>
  );
}
