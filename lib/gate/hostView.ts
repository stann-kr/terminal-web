import type { EventStatus } from '../events/types';
import type { PromoFile } from './promoKit';

/**
 * What an artist's host page shows. Guests appear by name only: no email, no Instagram id. Waiting
 * guests also show their Instagram id, which they agreed to share so the artist can tell them when
 * they are moved up.
 */
export interface HostView {
  artist: string;
  event: {
    id: string;
    session: string;
    subtitle: string;
    date: string;
    time: string;
    venue: string;
    status: EventStatus;
  };
  /** The guest code the invite link carries. */
  code: string;
  limit: number;
  count: number;
  /** Whether a guest opening the link now could send a request (window open, room left). */
  open: boolean;
  /** Newest first. */
  guests: { name: string; createdAt: string }[];
  /** Turned away by the limit and waiting, oldest first. */
  waitlist: { id: string; name: string; instagram: string; createdAt: string }[];
  /** Posters and teasers to download and post; `href`/`thumb` carry the link's own token. */
  kit: (Pick<PromoFile, 'label' | 'download' | 'width' | 'height' | 'bytes'> & { href: string; thumb: string })[];
}
