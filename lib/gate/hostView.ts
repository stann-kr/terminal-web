import type { EventStatus } from '../events/types';

/** What an artist's host page shows. Guests appear by name only: no email, no Instagram id. */
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
}
