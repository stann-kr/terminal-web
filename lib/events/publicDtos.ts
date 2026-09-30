import { isJsonObject, isString } from '@/lib/api/validation';
import { isValidEventDateTime } from './lifecycle';
import type {
  Artist,
  ArtistDescription,
  ArtistStatus,
  EventStatus,
  TerminalEvent,
} from './types';

const EVENT_STATUSES = new Set<EventStatus>(['UPCOMING', 'LIVE', 'ARCHIVED']);
const ARTIST_STATUSES = new Set<ArtistStatus>([
  'CONFIRMED',
  'CLASSIFIED',
  'PENDING',
  'ARCHIVED',
  'AWAITING DECRYPTION',
]);
const MAX_TEXT = 500;
const MAX_DESCRIPTION = 8_000;

function parseBoundedString(value: unknown, max = MAX_TEXT): string | null {
  if (!isString(value)) return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function parseOptionalDescription(value: unknown): ArtistDescription | string | string[] | undefined | null {
  if (value === undefined) return undefined;
  if (isString(value)) return value.length <= MAX_DESCRIPTION ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 100 || !value.every((line) => isString(line) && line.length <= MAX_TEXT)) return null;
    return value as string[];
  }
  if (!isJsonObject(value)) return null;

  const en = value.en;
  const ko = value.ko;
  const validLocalized = (entry: unknown): entry is string | string[] => (
    isString(entry) && entry.length <= MAX_DESCRIPTION
  ) || (
    Array.isArray(entry)
    && entry.length <= 100
    && entry.every((line) => isString(line) && line.length <= MAX_TEXT)
  );
  return validLocalized(en) && validLocalized(ko) ? { en, ko } : null;
}

export function parsePublicArtistRow(
  row: { id: string; eventId: string; data: string },
): Artist | null {
  let data: unknown;
  try {
    data = JSON.parse(row.data);
  } catch {
    return null;
  }
  if (!isJsonObject(data)) return null;

  const name = parseBoundedString(data.name, 100);
  const origin = parseBoundedString(data.origin, 40);
  const dock = parseBoundedString(data.dock, 40);
  const time = parseBoundedString(data.time, 80);
  const description = parseOptionalDescription(data.description);
  if (
    !name
    || !origin
    || !dock
    || !time
    || !isString(data.status)
    || !ARTIST_STATUSES.has(data.status as ArtistStatus)
    || description === null
  ) {
    return null;
  }

  return {
    id: row.id,
    name,
    origin,
    dock,
    time,
    status: data.status as ArtistStatus,
    ...(description === undefined ? {} : { description }),
  };
}

function parseLocalizedLines(value: unknown): TerminalEvent['invitationLines'] | undefined | null {
  if (value === undefined) return undefined;
  if (!isJsonObject(value)) return null;
  const validLines = (entry: unknown): entry is string[] => (
    Array.isArray(entry)
    && entry.length <= 20
    && entry.every((line) => isString(line) && line.length <= MAX_TEXT)
  );
  return validLines(value.en) && validLines(value.ko) ? { en: value.en, ko: value.ko } : null;
}

function parseLocalizedText(value: unknown): TerminalEvent['description'] | undefined | null {
  if (value === undefined) return undefined;
  if (!isJsonObject(value)) return null;
  return isString(value.en)
    && value.en.length <= MAX_DESCRIPTION
    && isString(value.ko)
    && value.ko.length <= MAX_DESCRIPTION
    ? { en: value.en, ko: value.ko }
    : null;
}

export function parsePublicEventRow(
  row: { id: string; data: string },
  eventArtists: Artist[],
): TerminalEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(row.data);
  } catch {
    return null;
  }
  if (!isJsonObject(data)) return null;

  const session = parseBoundedString(data.session, 100);
  const subtitle = parseBoundedString(data.subtitle, 200);
  const date = parseBoundedString(data.date, 10);
  const time = parseBoundedString(data.time, 20);
  const venue = parseBoundedString(data.venue, 200);
  const district = parseBoundedString(data.district, 200);
  const coords = parseBoundedString(data.coords, 100);
  const capacity = parseBoundedString(data.capacity, 100);
  const sound = parseBoundedString(data.sound, 200);
  const invitationLines = parseLocalizedLines(data.invitationLines);
  const description = parseLocalizedText(data.description);
  const posterUrl = data.posterUrl === undefined ? undefined : parseBoundedString(data.posterUrl, 2_048);

  if (
    !session || !subtitle || !date
    || !time || !venue || !district || !coords || !capacity || !sound
    || !isValidEventDateTime({ date, time })
    || !isString(data.status) || !EVENT_STATUSES.has(data.status as EventStatus)
    || invitationLines === null || description === null || posterUrl === null
  ) {
    return null;
  }

  return {
    id: row.id,
    session,
    subtitle,
    date,
    time,
    venue,
    district,
    coords,
    capacity,
    sound,
    status: data.status as EventStatus,
    artists: eventArtists,
    ...(invitationLines === undefined ? {} : { invitationLines }),
    ...(description === undefined ? {} : { description }),
    ...(posterUrl === undefined ? {} : { posterUrl }),
  };
}
