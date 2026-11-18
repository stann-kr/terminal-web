/**
 * Where a visitor first came in from, kept in a first-party cookie so a later public submission
 * (Transmit, guest request, Signal) can say which artist link, host page or outside site brought
 * them. Only the operator reads it (submission_traces); nothing here is shown publicly.
 *
 * The host link's `t` is the artist's credential and is never stored; an artist code is kept only in
 * the visitor's own cookie and is resolved to an artist id when the submission is recorded.
 */

export const ENTRY_COOKIE = 'tw_entry';
export const ENTRY_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Entry = {
  /** `code`: an artist invite link, `host`: an artist's host page, `ref`: an outside site. */
  kind: 'code' | 'host' | 'ref';
  /** Event id (code) or artist id (host). */
  target?: string;
  /** The artist code as written in the link (code only). */
  code?: string;
  /** Outside site the visitor came from, when the browser said. */
  referrer?: string;
  /** First seen, UTC ISO. */
  at: string;
};

const TOKEN = /^[A-Za-z0-9_.-]{1,64}$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function referrerHost(referer: string | null, ownHost: string): string | undefined {
  if (!referer) return undefined;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    if (!HOST.test(host) || host === ownHost.toLowerCase()) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/**
 * The entry a page visit carries, or null when it carries none: an artist code link
 * (`/events/<id>/request?code=`), an artist's host page (`/host/<artistId>`), or an outside referrer.
 */
export function entryFromVisit(url: URL, referer: string | null, now: Date): Entry | null {
  const at = now.toISOString();
  const referrer = referrerHost(referer, url.hostname);
  const [first, second, third] = url.pathname.split('/').filter(Boolean);

  const code = url.searchParams.get('code')?.trim();
  if (first === 'events' && third === 'request' && code) {
    const eventId = second && decodeSegment(second);
    if (eventId && TOKEN.test(eventId) && TOKEN.test(code)) {
      return { kind: 'code', target: eventId, code, ...(referrer ? { referrer } : {}), at };
    }
  }
  if (first === 'host' && second) {
    const artistId = decodeSegment(second);
    if (artistId && TOKEN.test(artistId)) return { kind: 'host', target: artistId, ...(referrer ? { referrer } : {}), at };
  }
  return referrer ? { kind: 'ref', referrer, at } : null;
}

/**
 * Whether a visit's entry replaces the stored one: an artist link or host page always does (it is
 * the strongest sign of who brought the visitor), an outside site only when nothing is stored yet.
 */
export function shouldStoreEntry(next: Entry | null, stored: Entry | null): next is Entry {
  if (!next) return false;
  return next.kind !== 'ref' || stored === null;
}

/** The cookie value as JSON; Next's cookie API percent-encodes it on the way out and decodes it on the way in. */
export const serializeEntry = (entry: Entry): string => JSON.stringify(entry);

/** The stored entry from the cookie's decoded value, or null when missing or not one this site wrote. */
export function parseEntry(value: string | undefined | null): Entry | null {
  if (!value || value.length > 1024) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;
    const { kind, target, code, referrer, at } = raw;
    if (kind !== 'code' && kind !== 'host' && kind !== 'ref') return null;
    if (typeof at !== 'string' || !ISO.test(at)) return null;
    if (target !== undefined && (typeof target !== 'string' || !TOKEN.test(target))) return null;
    if (code !== undefined && (typeof code !== 'string' || !TOKEN.test(code))) return null;
    if (referrer !== undefined && (typeof referrer !== 'string' || !HOST.test(referrer))) return null;
    if (kind !== 'ref' && !target) return null;
    if (kind === 'code' && !code) return null;
    if (kind === 'ref' && !referrer) return null;
    return {
      kind,
      at,
      ...(target ? { target } : {}),
      ...(code ? { code } : {}),
      ...(referrer ? { referrer } : {}),
    };
  } catch {
    return null;
  }
}

/** The entry in a raw Cookie request header (percent-encoded, as Next writes it). */
export function readEntryCookie(cookieHeader: string | null): Entry | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === ENTRY_COOKIE) {
      try {
        return parseEntry(decodeURIComponent(part.slice(index + 1).trim()));
      } catch {
        return null;
      }
    }
  }
  return null;
}
