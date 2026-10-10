export type EventStatus = "UPCOMING" | "LIVE" | "ARCHIVED";
export type ArtistStatus =
  | "CONFIRMED"
  | "CLASSIFIED"
  | "PENDING"
  | "ARCHIVED"
  | "AWAITING DECRYPTION";

export interface ArtistDescription {
  en: string | string[];
  ko: string | string[];
}

export interface Artist {
  id: string;
  name: string;
  origin: string;
  dock: string;
  time: string;
  status: ArtistStatus;
  description?: ArtistDescription | string | string[];
}

export interface TerminalEvent {
  id: string;
  session: string;
  subtitle: string;
  stage?: { en: string; ko: string };
  log?: { en: string; ko: string };
  date: string;
  time: string;
  /** When the night ends, `HH:MM` KST: the first such time after the start (`05:00` is the next morning). */
  endTime?: string;
  venue: string;
  district: string;
  coords: string;
  capacity: string;
  sound: string;
  status: EventStatus;
  artists: Artist[];
  invitationLines?: {
    en: string[];
    ko: string[];
  };
  description?: {
    en: string;
    ko: string;
  };
  posterUrl?: string;
}
