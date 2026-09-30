'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, publicArtists, statusLabel } from '@/features/events/model';
import { Bay, BrandText, Panel } from '@/features/ui/Ui';
import { artistHref, buildArtistArchive, profileForAppearance, type ArtistProfile } from './model';
import styles from './artists.module.css';

/**
 * An artist's public appearances, newest record first as the archive gives them, and everyone who
 * shared a lineup with them. Session and artist links open their files, growing from the row.
 */
export function ArtistChronology({
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
      <Panel title="출연 기록" label="Records" surface="panel" className={styles.chronology}>
        <ol className={styles.timeline}>
          {profile.appearances.map(({ event, artist }) => (
            <li key={`${event.id}:${artist.id}`} data-origin="">
              <time dateTime={event.date}>{event.date}</time>
              <div className={styles.recordBody}>
                <span className={styles.state}>{statusLabel(event.status)}</span>
                <Link href={eventHref(event.id)} data-carrier={`event:${event.id}`} scroll={false}><BrandText text={event.session} /></Link>
                <p>{event.venue}</p>
              </div>
              <p className={styles.slot}>
                <span>DOCK {artist.dock || 'TBA'}</span>
                <b>{artist.time || 'TBA'}</b>
              </p>
            </li>
          ))}
        </ol>
      </Panel>
      {shared.size > 0 && (
        <Panel title="같은 세션 출연진" label="Shared lineup" surface="inset" className={styles.shared}>
          <ul className={styles.sharedCells}>
            {[...shared.entries()].map(([key, other]) => (
              <SharedCell key={key}>
                {other.href ? <Link href={other.href} data-carrier={`artist:${key}`} scroll={false}>{other.name}</Link> : <span>{other.name}</span>}
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

/** A shared-lineup cell; a linked one opens that artist's file, growing from this cell. */
function SharedCell({ children }: { children: ReactNode }) {
  return <li data-origin="">{children}</li>;
}
