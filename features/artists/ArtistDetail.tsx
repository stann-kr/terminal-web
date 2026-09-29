'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Morph } from '@/features/display/Morph';
import { EventsData } from '@/features/events/data';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, paragraphs, publicArtists, statusLabel } from '@/features/events/model';
import { useLanguage } from '@/features/shell/Providers';
import {
  Action,
  ActionDeck,
  Bay,
  BrandText,
  FullText,
  PageHeading,
  Panel,
  StateNotice,
} from '@/features/ui/Ui';
import { artistHref, buildArtistArchive, profileForAppearance, type ArtistProfile } from './model';
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
              <ArtistChronology profile={profile} events={events} />
              <ArtistBiography profile={profile} language={language} />
            </div>
          </>
        );
      }}
    </EventsData>
  );
}

function ArtistProfileSummary({ profile }: { profile: ArtistProfile }) {
  const upcoming = profile.appearances.some((row) => row.event.status !== 'ARCHIVED');
  return (
    <div className={styles.column}>
      <Morph name={`artist-${profile.key}`}>
      <Panel title="프로필" label="Artist file" surface={profile.key === 'stann-lumo' ? 'orange' : upcoming ? 'gold' : 'cream'} className={styles.profile}>
        <div className={styles.identity} aria-hidden="true">
          <p className={styles.identityOrigin}>ORIGIN / {profile.origin || '—'}</p>
          <strong className={styles.profileName}>{profile.name}</strong>
          <p className={styles.identityCode}>{profile.origin || 'XX'}-{serialOf(profile.key)}</p>
        </div>
      </Panel>
      </Morph>
      <ActionDeck>
        <Action href="/artists">전체 아티스트</Action>
      </ActionDeck>
    </div>
  );
}

/** A printed four-digit serial derived from the profile key; ornament, not an identifier. */
function serialOf(key: string) {
  const sum = Array.from(key).reduce((total, char, index) => (total * 31 + char.charCodeAt(0) * (index + 1)) % 9973, 7);
  return String(sum % 10000).padStart(4, '0');
}

function ArtistChronology({
  profile,
  events,
}: {
  profile: ArtistProfile;
  events: TerminalEvent[];
}) {
  const profiles = buildArtistArchive(events);
  // Everyone who shared a public lineup with this artist, linked to their own file.
  const shared = new Map<string, { name: string; href?: string; session: string }>();
  for (const { event, artist } of profile.appearances) {
    for (const other of publicArtists(event)) {
      if (other.id === artist.id) continue;
      const file = profileForAppearance(profiles, event.id, other.id);
      if (file?.key === profile.key) continue;
      const key = file?.key ?? `${event.id}:${other.id}`;
      if (!shared.has(key)) shared.set(key, { name: other.name, href: file ? artistHref(file.key) : undefined, session: event.session });
    }
  }
  return (
    <div className={styles.column}>
      <Panel title="출연 기록" label="Records" surface="navy" className={styles.chronology}>
        <ol className={styles.timeline} data-cells="">
          {profile.appearances.map(({ event, artist }) => (
            <li key={`${event.id}:${artist.id}`}>
              <time dateTime={event.date}>{event.date}</time>
              <div className={styles.recordBody}>
                <span className={styles.state}>{statusLabel(event.status)}</span>
                <Link href={eventHref(event.id)}><BrandText text={event.session} /></Link>
                <p>{event.venue}</p>
              </div>
              <p className={styles.slot}>
                <span>STAGE {artist.dock || 'TBA'}</span>
                <b>{artist.time || 'TBA'}</b>
              </p>
            </li>
          ))}
        </ol>
      </Panel>
      {shared.size > 0 && (
        <Panel title="같은 세션 출연진" label="Shared lineup" surface="navy" className={styles.shared}>
          <ul className={styles.sharedCells} data-cells="">
            {[...shared.entries()].map(([key, other]) => (
              <SharedCell key={key} name={other.href ? `artist-${key}` : undefined}>
                {other.href ? <Link href={other.href}>{other.name}</Link> : <span>{other.name}</span>}
                <small aria-hidden="true">{other.session}</small>
              </SharedCell>
            ))}
          </ul>
          <Bay label="SHARED LINEUP" />
        </Panel>
      )}
    </div>
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
    <Panel title="소개" label="Biography" code={language.toUpperCase()} surface="navy">
      <FullText
        language={language}
        excerpt={false}
        paragraphs={paragraphs(biography?.artist.description, language)}
      />
      {biography && (
        <p className={styles.note}>
          출처:{' '}
          <Link href={eventHref(biography.event.id)}>
            <BrandText text={biography.event.session} /> / {biography.event.date}
          </Link>
        </p>
      )}
    </Panel>
  );
}

/** A shared-lineup cell; a linked one carries its artist over into the next profile plate. */
function SharedCell({ name, children }: { name?: string; children: ReactNode }) {
  const cell = <li>{children}</li>;
  return name ? <Morph name={name}>{cell}</Morph> : cell;
}
