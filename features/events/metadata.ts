import type { Metadata } from 'next';
import type { TerminalEvent } from '@/lib/events/types';
import { getEventDateTime, getEventEndTime } from '@/lib/events/lifecycle';
import { buildArtistArchive, type ArtistProfile } from '@/features/artists/model';
import { eventHref, eventSubtitle, paragraphs, publicArtists } from './model';

/** The site's public address: link previews, the sitemap and structured data name pages by it. */
export const SITE_ORIGIN = 'https://terminal.stann.kr';

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

/** `2026-11-28T23:00:00+09:00`: a moment as the KST wall clock reads it. */
const kstIso = (date: Date) => `${new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0, 19)}+09:00`;

/**
 * A session as schema.org MusicEvent, for search engines that list events: only what the record
 * says (the end when it is known, the published lineup, the poster when there is one).
 */
export function eventStructuredData(event: TerminalEvent) {
  const end = getEventEndTime(event);
  const lineup = publicArtists(event);
  const about = paragraphs(event.description, 'ko')[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: event.session,
    url: `${SITE_ORIGIN}${eventHref(event.id)}`,
    startDate: kstIso(getEventDateTime(event)),
    ...(end ? { endDate: kstIso(end) } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venue,
      address: { '@type': 'PostalAddress', addressLocality: event.district.replace(/\s*\/+\s*/g, ', '), addressCountry: 'KR' },
    },
    ...(event.posterUrl ? { image: [event.posterUrl] } : {}),
    ...(about ? { description: about } : {}),
    ...(lineup.length ? { performer: lineup.map((artist) => ({ '@type': 'Person', name: artist.name })) } : {}),
    organizer: { '@type': 'Organization', name: 'TERMINAL', url: SITE_ORIGIN },
  };
}

/** Structured data as the text of a `<script type="application/ld+json">`: `<` is escaped so no value can close the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
