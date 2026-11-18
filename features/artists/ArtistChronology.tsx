'use client';
import Link from '@/features/ui/RouteLink';
import type { ReactNode } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref, eventSubtitle, publicArtists, sessionShort, statusLabel } from '@/features/events/model';
import { Arrow, Bay, BrandText, Panel } from '@/features/ui/Ui';
import { artistHref, buildArtistArchive, profileForAppearance, type ArtistProfile } from './model';
import styles from './artists.module.css';

/**
 * An artist's public appearances, newest record first as the archive gives them, and everyone who
 * shared a lineup with them. The biography sits between them in document order, at every width.
 * Session and artist links open their files, growing from the row.
 */
/** A session's number as its name prints it (`03` of `TERMINAL [03]`). */
const sessionNumber = (event: TerminalEvent) => /\[(\d+)\]/.exec(event.session)?.[1] ?? event.id;

/** A linked name and its arrow: the last word and the arrow wrap together, never the arrow alone. */
function NameWithArrow({ text }: { text: string }) {
  const cut = text.lastIndexOf(' ') + 1;
  return (
    <>
      {cut > 0 && <BrandText text={text.slice(0, cut)} />}
      <span className={styles.nameTail}><BrandText text={text.slice(cut)} /><Arrow /></span>
    </>
  );
}

export function ArtistChronology({
  profile,
  events,
  children,
  recordsClassName,
  sharedClassName,
}: {
  profile: ArtistProfile;
  events: TerminalEvent[];
  children: ReactNode;
  recordsClassName: string;
  sharedClassName: string;
}) {
  const profiles = buildArtistArchive(events);
  // Everyone who shared a public lineup with this artist, linked to their own file.
  const shared = new Map<string, { name: string; href?: string; number: string }>();
  for (const { event, artist } of profile.appearances) {
    for (const other of publicArtists(event)) {
      if (other.id === artist.id) continue;
      const file = profileForAppearance(profiles, event.id, other.id);
      if (file?.key === profile.key) continue;
      const key = file?.key ?? `${event.id}:${other.id}`;
      if (!shared.has(key)) shared.set(key, { name: other.name, href: file ? artistHref(file.key) : undefined, number: sessionNumber(event) });
    }
  }
  return (
    <>
      <div className={recordsClassName} data-fit="">
        <Panel title="출연 기록" label="Records" surface="panel" className={styles.chronology}>
          <ol className={styles.timeline}>
            {profile.appearances.map(({ event, artist }) => (
              <li key={`${event.id}:${artist.id}`} data-origin="">
                {/* The date and the state; the session's wordmark and number over its subtitle; the set. */}
                <p className={styles.recordWhen}>
                  <time dateTime={event.date}>{event.date}</time>
                  <span className={styles.state}>{statusLabel(event.status)}</span>
                </p>
                <div className={styles.recordBody}>
                  <Link href={eventHref(event.id)} data-carrier={`event:${event.id}`} scroll={false} aria-label={`${sessionShort(event.session)}${eventSubtitle(event) ? ` ${eventSubtitle(event)}` : ''}`}>
                    <span className={styles.recordWord} aria-hidden="true"><BrandText text={sessionShort(event.session)} /></span>
                    <span className={styles.recordName} aria-hidden="true">
                      <span className={styles.recordNum}>[{sessionNumber(event)}] </span>
                      {eventSubtitle(event) ? <NameWithArrow text={eventSubtitle(event)} /> : <Arrow />}
                    </span>
                  </Link>
                </div>
                <p className={styles.slot}>
                  <span className={styles.slotWide}>DOCK {artist.dock || 'TBA'} · {artist.time || 'TBA'}</span>
                  <span className={styles.slotShort} aria-hidden="true">D{artist.dock || '-'} {artist.time.split(/\s*[-–]\s*/)[0] || 'TBA'}</span>
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      {children}
      {shared.size > 0 && (
        <div className={sharedClassName} data-fit="">
          <Panel title="같은 세션 출연진" label="Shared lineup" surface="inset" className={styles.shared}>
            <ul className={styles.sharedCells}>
              {[...shared.entries()].map(([key, other]) => (
                <SharedCell key={key}>
                  {other.href ? <Link href={other.href} data-carrier={`artist:${key}`} scroll={false}>{other.name}<Arrow /></Link> : <span>{other.name}</span>}
                  <small aria-hidden="true">[{other.number}]</small>
                </SharedCell>
              ))}
            </ul>
            <Bay label="SHARED LINEUP" />
          </Panel>
        </div>
      )}
    </>
  );
}

/** A shared-lineup cell; a linked one opens that artist's file, growing from this cell. */
function SharedCell({ children }: { children: ReactNode }) {
  return <li data-origin="">{children}</li>;
}
