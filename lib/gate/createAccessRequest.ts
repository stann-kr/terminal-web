import { hasOnlyKeys, isBoolean, isJsonObject, isString } from '../api/validation';
import type { EventStatus, TerminalEvent } from '../events/types';
import { getEffectiveEventStatus, getEventDateTime, getRequestWindowState } from '../events/lifecycle';
import { ACCESS_WINDOW_DAYS } from './requestPolicy';

const MAX_ACCESS_CODE_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;
const MAX_GUEST_LIMIT = 10_000;
const REQUEST_KEYS = [
  'eventId',
  'accessCode',
  'invitedBy',
  'name',
  'email',
  'instagram',
  'privacyConsent',
  'marketingConsent',
] as const;

export interface GateRequestInput {
  eventId: string;
  accessCode: string;
  name: string;
  email: string;
  instagram: string;
  privacyConsent: true;
  marketingConsent: boolean;
}

export type ParseGateRequestResult =
  | { ok: true; input: GateRequestInput }
  | { ok: false; error: string };

export interface ArtistAccessData {
  guestCode: string;
  guestLimit: number;
  name: string;
}

export type ArtistAccessInspection =
  | { kind: 'unconfigured' }
  | { kind: 'invalid' }
  | { kind: 'configured'; data: ArtistAccessData };

export interface UpcomingEventCandidate {
  rowId: string;
  lifecycle: Pick<TerminalEvent, 'date' | 'time' | 'status'>;
}

export interface StoredGateEventRow {
  id: string;
  data: string;
}

export interface StoredGateArtistRow {
  id: string;
  data: string;
}

const EVENT_STATUSES = new Set<EventStatus>(['UPCOMING', 'LIVE', 'ARCHIVED']);

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function decodeStoredEventLifecycle(
  rowId: string,
  rawData: string,
): UpcomingEventCandidate | null {
  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (
    !isJsonObject(data)
    || !isString(data.date)
    || !isString(data.time)
    || !isString(data.status)
    || !EVENT_STATUSES.has(data.status as EventStatus)
  ) {
    return null;
  }

  const lifecycle: UpcomingEventCandidate['lifecycle'] = {
    date: data.date,
    time: data.time,
    status: data.status as EventStatus,
  };

  if (!Number.isFinite(getEventDateTime(lifecycle).getTime())) return null;

  return { rowId, lifecycle };
}

export function parseUpcomingEventCandidate(
  rowId: string,
  rawData: string,
  now: Date,
): UpcomingEventCandidate | null {
  const candidate = decodeStoredEventLifecycle(rowId, rawData);
  return candidate && getEffectiveEventStatus(candidate.lifecycle, now) === 'UPCOMING'
    ? candidate
    : null;
}

/** Chooses the next valid, not-yet-elapsed UPCOMING event from stored rows. */
export function findUpcomingGateEvent(
  rows: StoredGateEventRow[],
  now: Date,
): UpcomingEventCandidate | null {
  return rows
    .map((row) => parseUpcomingEventCandidate(row.id, row.data, now))
    .filter((candidate): candidate is UpcomingEventCandidate => candidate !== null)
    .sort(
      (a, b) => getEventDateTime(a.lifecycle).getTime() - getEventDateTime(b.lifecycle).getTime()
        || (a.rowId < b.rowId ? -1 : a.rowId > b.rowId ? 1 : 0),
    )[0] ?? null;
}

export function isGateRequestWindowActive(event: UpcomingEventCandidate, now: Date): boolean {
  return getRequestWindowState(event.lifecycle, ACCESS_WINDOW_DAYS, now).isActive;
}

export function parseGateRequestBody(body: Record<string, unknown>): ParseGateRequestResult {
  if (!hasOnlyKeys(body, REQUEST_KEYS)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  const eventIdResult = parseGateEventId(body.eventId);
  if (!eventIdResult.ok) return eventIdResult;
  if (
    !isString(body.name)
    || !isString(body.email)
    || !isString(body.instagram)
    || !isString(body.accessCode)
  ) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  if (body.invitedBy !== undefined && !isString(body.invitedBy)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  if (!isBoolean(body.privacyConsent)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  if (body.marketingConsent !== undefined && !isBoolean(body.marketingConsent)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }

  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();
  const instagram = body.instagram.trim();
  const accessCode = body.accessCode.trim();
  const invitedBy = body.invitedBy?.trim() || null;

  if (!name || !email || !instagram || !accessCode) {
    return { ok: false, error: 'ALL_FIELDS_REQUIRED' };
  }
  if (!body.privacyConsent) {
    return { ok: false, error: 'PRIVACY_CONSENT_REQUIRED' };
  }
  if (
    name.length > 100
    || email.length > MAX_EMAIL_LENGTH
    || accessCode.length > MAX_ACCESS_CODE_LENGTH
    || (invitedBy?.length ?? 0) > 100
  ) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'INVALID_EMAIL_FORMAT' };
  }

  const cleanInstagram = instagram.replace(/^@/, '');
  if (
    cleanInstagram.length === 0
    || cleanInstagram.length > 30
    || !/^[\w.]+$/.test(cleanInstagram)
  ) {
    return { ok: false, error: 'INVALID_INSTAGRAM_FORMAT' };
  }

  return {
    ok: true,
    input: {
      eventId: eventIdResult.eventId,
      accessCode,
      name,
      email,
      instagram,
      privacyConsent: true,
      marketingConsent: body.marketingConsent ?? false,
    },
  };
}

/** A client event id binds the visible form to the server-selected event; it grants no access. */
export function parseGateEventId(value: unknown):
  | { ok: true; eventId: string }
  | { ok: false; error: string } {
  if (value === undefined || value === '') return { ok: false, error: 'EVENT_ID_REQUIRED' };
  if (!isString(value) || value.length > 128 || !value.trim()) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  return { ok: true, eventId: value.trim() };
}

export function inspectArtistAccessData(rawData: string): ArtistAccessInspection {
  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch {
    return { kind: 'invalid' };
  }

  if (!isJsonObject(data)) return { kind: 'invalid' };
  if (!Object.hasOwn(data, 'guestCode')) return { kind: 'unconfigured' };
  if (!isString(data.guestCode)) return { kind: 'invalid' };

  const guestCode = data.guestCode.trim();
  if (!guestCode || guestCode.length > MAX_ACCESS_CODE_LENGTH) {
    return { kind: 'invalid' };
  }

  if (
    typeof data.guestLimit !== 'number'
    || !Number.isSafeInteger(data.guestLimit)
    || data.guestLimit < 0
    || data.guestLimit > MAX_GUEST_LIMIT
  ) {
    return { kind: 'invalid' };
  }

  if (!isString(data.name)) {
    return { kind: 'invalid' };
  }

  const name = data.name.trim();
  if (!name || name.length > 100) return { kind: 'invalid' };

  return { kind: 'configured', data: { guestCode, guestLimit: data.guestLimit, name } };
}

export function parseArtistAccessData(rawData: string): ArtistAccessData | null {
  const inspected = inspectArtistAccessData(rawData);
  return inspected.kind === 'configured' ? inspected.data : null;
}

export type ArtistAccessCodeResolution =
  | { kind: 'match'; artistId: string; data: ArtistAccessData }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

/**
 * Evaluates every artist record before returning a match so malformed stored
 * access configuration cannot silently alter verification results.
 */
export function resolveArtistAccessCode(
  rows: StoredGateArtistRow[],
  accessCode: string,
): ArtistAccessCodeResolution {
  const normalizedCode = normalizeAccessCode(accessCode);
  const accessRecords = rows.map((row) => ({ row, access: inspectArtistAccessData(row.data) }));
  if (accessRecords.some(({ access }) => access.kind === 'invalid')) {
    return { kind: 'unavailable' };
  }

  const matches = accessRecords.flatMap(({ row, access }) => (
    access.kind === 'configured' && normalizeAccessCode(access.data.guestCode) === normalizedCode
      ? [{ artistId: row.id, data: access.data }]
      : []
  ));

  return matches.length === 1 ? { kind: 'match', ...matches[0] } : { kind: 'not_found' };
}
