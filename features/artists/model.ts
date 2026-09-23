import type { Artist, TerminalEvent } from '@/lib/events/types';
import { getEventDateTime } from '@/lib/events/lifecycle';
import { isPublicArtist } from '@/features/events/model';
import { artistIdentities, type ArtistIdentity } from './identities';
export type Appearance = { event: TerminalEvent; artist: Artist };
export interface ArtistProfile { key: string; name: string; origin: string; verified: boolean; appearances: Appearance[]; eventCount: number }
export const appearanceKey = (eventId: string, rowId: string) => `appearance:${encodeURIComponent(eventId)}:${encodeURIComponent(rowId)}`;
export const artistHref = (key: string) => `/artists/${encodeURIComponent(key)}`;
export function buildArtistArchive(events: readonly TerminalEvent[], identities: readonly ArtistIdentity[] = artistIdentities): ArtistProfile[] {
  const mapping = new Map<string,string>();
  for (const identity of identities) for (const row of identity.appearances) {
    const ref = appearanceKey(row.eventId,row.artistRowId);
    if (mapping.has(ref)) throw new Error('Artist appearance maps to multiple identities');
    mapping.set(ref,identity.key);
  }
  const profiles = new Map<string,ArtistProfile>();
  for (const event of events) for (const artist of event.artists.filter(isPublicArtist)) {
    const ref = appearanceKey(event.id,artist.id);
    const canonical = mapping.get(ref);
    const key = canonical ?? ref;
    const profile = profiles.get(key) ?? { key, name: artist.name, origin: artist.origin, verified: !!canonical, appearances: [], eventCount: 0 };
    profile.appearances.push({ event,artist });
    profiles.set(key,profile);
  }
  return [...profiles.values()].map(profile => {
    profile.appearances.sort((a,b) => getEventDateTime(b.event).getTime() - getEventDateTime(a.event).getTime() || a.event.id.localeCompare(b.event.id));
    return { ...profile, name: profile.appearances[0].artist.name, origin: profile.appearances[0].artist.origin, eventCount: new Set(profile.appearances.map(row => row.event.id)).size };
  });
}
export function profileForAppearance(profiles: ArtistProfile[], eventId: string, rowId: string) { return profiles.find(profile => profile.appearances.some(row => row.event.id === eventId && row.artist.id === rowId)); }
