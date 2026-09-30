'use client';
import Link from 'next/link';
import type { Artist, TerminalEvent } from '@/lib/events/types';
import { Action, ActionDeck, Facts, ui } from '@/features/ui/Ui';
import {
  buildArtistArchive,
  profileForAppearance,
  artistHref,
} from '@/features/artists/model';
import { accessAvailability, eventHref, publicArtists } from './model';
import styles from './events.module.css';

export function EventFacts({
  event,
  modular = false,
}: {
  event: TerminalEvent;
  modular?: boolean;
}) {
  const groups = [
    {
      label: 'DATE / TIME',
      rows: [
        ['날짜', event.date],
        ['시작 / KST', event.time.replace(' KST', '')],
      ],
    },
    {
      label: 'VENUE',
      rows: [
        ['장소', event.venue],
        ['지역', event.district],
        ['좌표', event.coords],
      ],
    },
  ];
  if (modular)
    return (
      <div className={styles.factModules}>
        {groups.map((group) => (
          <div key={group.label} className={styles.factModule}>
            <p lang="en">
              {group.label}
            </p>
            <Facts rows={group.rows.map(([label, value]) => [label, value])} />
          </div>
        ))}
      </div>
    );
  return (
    <Facts
      rows={[
        ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
        ['장소', event.venue],
        ['지역', event.district],
        ['좌표', event.coords],
      ]}
    />
  );
}
export function EventActions({
  event,
  events,
  now,
}: {
  event: TerminalEvent;
  events: TerminalEvent[];
  now: Date;
}) {
  const access = accessAvailability(event, events, now);
  return (
    <>
    <div className={styles.accessProtocol} data-open={access.canRequest}>
      <p
        data-open={access.canRequest}
        className={styles.protocolLabel}
        lang="en"
      >
        {access.canRequest
          ? 'ACCESS OPEN'
          : event.status === 'ARCHIVED'
            ? 'ARCHIVE RECORD'
            : 'ACCESS INFO'}
      </p>
      <p className={ui.muted}>{access.message}</p>
    </div>
    <ActionDeck label="ACCESS" className={styles.accessDeck}>
      {access.canRequest && (
        <Action primary href={`${eventHref(event.id)}/request`} carrier={`event:${event.id}`}>
          게스트 신청
        </Action>
      )}
      <Action href="/signal">다음 행사 소식 신청</Action>
    </ActionDeck>
    </>
  );
}
export function Lineup({
  event,
  events,
  stages = false,
}: {
  event: TerminalEvent;
  events: TerminalEvent[];
  stages?: boolean;
}) {
  const profiles = buildArtistArchive(events);
  const visible = publicArtists(event);
  function identity(artist: Artist) {
    const profile = profileForAppearance(profiles, event.id, artist.id);
    return (
      <>
        {profile ? (
          <Link href={artistHref(profile.key)} data-carrier={`artist:${profile.key}`} scroll={false}>{artist.name}</Link>
        ) : (
          artist.name
        )}
        <small>{artist.origin}</small>
      </>
    );
  }
  const identityLinked = (artist: Artist) => !!profileForAppearance(profiles, event.id, artist.id);
  if (!visible.length) return null;
  return (
    <>
      {stages ? (
        <div className={styles.stageBoard}>
          {[...new Set(visible.map((artist) => artist.dock || 'TBA'))].map(
            (dock) => (
              <section
                className={styles.stage}
                key={dock}
                aria-label={`무대 ${dock}`}
              >
                <h3>
                  <span>STAGE {dock}</span>
                  <span>공개 공연표</span>
                </h3>
                <ul className={styles.stageSlots}>
                  {visible
                    .filter((artist) => (artist.dock || 'TBA') === dock)
                    .map((artist) => (
                      <li key={artist.id} data-origin="">
                        <div className={styles.slotCode}>
                          {artist.id}
                          <span>
                            {artist.status === 'ARCHIVED'
                              ? 'ARCHIVE'
                              : 'CONFIRMED'}
                          </span>
                        </div>
                        <div className={styles.slotArtist} data-linked={identityLinked(artist) || undefined}>
                          {identity(artist)}
                        </div>
                        <p className={styles.slotTime}>
                          <span>TIME</span>
                          {artist.time}
                        </p>
                      </li>
                    ))}
                </ul>
              </section>
            ),
          )}
        </div>
      ) : (
        <ul className={styles.lineup}>
          {visible.map((artist) => (
            <li key={artist.id} data-origin="">
              <span className={styles.dock}>{artist.dock}</span>
              <div>{identity(artist)}</div>
              <time>{artist.time}</time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
