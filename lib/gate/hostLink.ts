import { hmacHex, verifyHmacHex } from '../api/signature';
import { normalizeAccessCode } from './createAccessRequest';

/**
 * The token in an artist's host link (`/host/<artist id>?t=<token>`): HMAC-SHA256 of the artist
 * row and its current guest code, under the secret the mail links use. The `host:` prefix keeps it
 * from ever matching an unsubscribe token, and signing the code means a new code (after a leak)
 * retires the old host link too.
 */
const ARTIST_ID = /^[A-Za-z0-9-]{1,64}$/;

const hostMessage = (artistId: string, guestCode: string) => `host:${artistId}:${normalizeAccessCode(guestCode)}`;

export function signHostLink(secret: string, artistId: string, guestCode: string): Promise<string> {
  return hmacHex(secret, hostMessage(artistId, guestCode));
}

export async function verifyHostLink(secret: string, artistId: string, guestCode: string, token: string): Promise<boolean> {
  return ARTIST_ID.test(artistId) && verifyHmacHex(secret, hostMessage(artistId, guestCode), token);
}

export const isArtistId = (value: string) => ARTIST_ID.test(value);

/** The path an artist opens; the site origin is added where the link is printed. */
export function hostHref(artistId: string, token: string): string {
  return `/host/${encodeURIComponent(artistId)}?${new URLSearchParams({ t: token })}`;
}
