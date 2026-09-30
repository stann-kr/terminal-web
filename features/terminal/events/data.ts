import type { Artist, TerminalEvent } from '@/lib/events/types';
export type { Lang } from '@/lib/lang';
import type { Lang } from '@/lib/lang';

export type EntryMode = 'auto' | 'boot' | 'idle';
export type Page = 'artists' | 'home' | 'gate' | 'lineup' | 'request' | 'status' | 'transmit' | 'signal' | 'about' | 'link' | 'entry';
export type Translate = (ko: string, en: string) => string;
export const pagePaths: Record<Page, string> = {
  artists: '/artists', home: '/home', gate: '/gate', lineup: '/lineup', request: '/gate/request',
  status: '/status', transmit: '/transmit', signal: '/signal', about: '/about', link: '/link', entry: '/entry',
};

export function href(page: Page, event?: string, artist?: string) {
  const query = new URLSearchParams();
  if (event) query.set('event', event);
  if (artist) query.set('artist', artist);
  return `${pagePaths[page]}${query.size ? `?${query}` : ''}`;
}

export function isPublicArtist(artist: Artist) {
  return artist.status === 'CONFIRMED' || artist.status === 'ARCHIVED';
}

export function biography(artist: Artist, lang: Lang): string[] {
  const source = artist.description;
  const text = typeof source === 'object' && !Array.isArray(source) ? source[lang] : source;
  return (Array.isArray(text) ? text : text?.split('\n') ?? []).filter(line => line.trim());
}

export interface ScreenProps {
  lang: Lang;
  t: Translate;
  event: TerminalEvent | null;
  events: TerminalEvent[];
  now: Date;
}
