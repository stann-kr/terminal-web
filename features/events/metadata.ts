import type { Metadata } from 'next';
import type { TerminalEvent } from '@/lib/events/types';
import { buildArtistArchive, type ArtistProfile } from '@/features/artists/model';
import { eventHref, eventSubtitle, publicArtists } from './model';

export const sessionNamesBrand = (session: string) => /\bTERMINAL\b/i.test(session);

/** What a shared session link shows: its name, when and where, and the lineup once it is public. */
export function eventMetadata(event: TerminalEvent, prefix = ''): Metadata {
  const title = `${prefix}${event.session}`;
  // Session names usually carry the brand already (`TERMINAL [03]`); it is not repeated after them.
  const branded = sessionNamesBrand(event.session);
  const lineup = publicArtists(event).map((artist) => artist.name);
  const description = [
    `${event.date} ${event.time}`,
    `${event.venue} · ${event.district}`,
    // The name already carries its subtitle (`TERMINAL [03] : Interstellar Junction`).
    event.session.includes(eventSubtitle(event)) ? '' : eventSubtitle(event),
    lineup.length ? `LINEUP ${lineup.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' — ');
  return {
    title: branded ? { absolute: title } : title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'TERMINAL',
      title: branded ? title : `${title} / TERMINAL`,
      description,
      url: eventHref(event.id),
      ...(event.posterUrl ? { images: [{ url: event.posterUrl, alt: event.session }] } : {}),
    },
  };
}

/** An artist file link: the name and the sessions it played. */
export function artistMetadata(profile: ArtistProfile): Metadata {
  const sessions = profile.appearances.map(({ event }) => event.session);
  const description = [
    profile.origin,
    `TERMINAL ${profile.eventCount}회 출연`,
    [...new Set(sessions)].join(', '),
  ]
    .filter(Boolean)
    .join(' — ');
  return {
    title: profile.name,
    description,
    openGraph: { type: 'profile', siteName: 'TERMINAL', title: `${profile.name} / TERMINAL`, description },
  };
}

export function findArtistProfile(events: readonly TerminalEvent[], key: string) {
  return buildArtistArchive(events).find((profile) => profile.key === key);
}
