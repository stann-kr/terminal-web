import type { Entry } from './entry';

/**
 * One operator-only record of where a public submission came from. It never reaches a public
 * response; the raw IP is never kept, only a keyed hash that groups one address's submissions.
 */
export type SubmissionKind = 'transmit' | 'gate' | 'signal';

export type SubmissionTrace = {
  kind: SubmissionKind;
  recordId: string;
  createdAt: string;
  country: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  asOrg: string | null;
  ipHash: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  entryKind: Entry['kind'] | null;
  entryArtistId: string | null;
  entryEventId: string | null;
  entryReferrer: string | null;
  entryAt: string | null;
};

/** The Cloudflare request properties a trace reads (request.cf); absent off Cloudflare. */
export type TraceCf = {
  country?: unknown;
  region?: unknown;
  city?: unknown;
  asn?: unknown;
  asOrganization?: unknown;
};

const text = (value: unknown, max = 120): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

/** Browser, OS and device class from a User-Agent; in-app browsers are named for the app. */
export function summarizeUserAgent(userAgent: string | null): Pick<SubmissionTrace, 'browser' | 'os' | 'device'> {
  if (!userAgent) return { browser: null, os: null, device: null };
  const ua = userAgent;
  const browser =
    /Instagram/i.test(ua) ? 'Instagram'
    : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook'
    : /KAKAOTALK/i.test(ua) ? 'KakaoTalk'
    : /NAVER\(inapp/i.test(ua) ? 'Naver'
    : /Line\//.test(ua) ? 'LINE'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : /bot|crawl|spider|curl|wget|python|node/i.test(ua) ? 'Bot/Script'
    : 'Other';
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Other';
  const device = /iPad|Tablet/.test(ua) ? 'tablet' : /Mobi|iPhone|Android/.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

/**
 * The part of an address that names one connection: IPv4 whole, IPv6 its /64 (a device's own
 * suffix changes often, its network prefix does not). null when the value is not an address.
 */
export function addressKey(ip: string | null): string | null {
  if (!ip) return null;
  const value = ip.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return value;
  if (!value.includes(':') || !/^[0-9a-fA-F:.]+$/.test(value)) return null;
  const [head, tail] = value.split('::');
  const left = head ? head.split(':') : [];
  const right = tail === undefined ? [] : tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  if (groups.length < 4) return null;
  return `${groups.slice(0, 4).map((group) => group.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/** Keyed hash of an address key: the same address gives the same hash, and the key stays secret. */
export async function hashAddress(key: string | null, secret: string | undefined): Promise<string | null> {
  if (!key || !secret) return null;
  const encoder = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(key)));
  return Array.from(signature.slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type TraceInput = {
  kind: SubmissionKind;
  recordId: string;
  now: Date;
  headers: Headers;
  cf: TraceCf | undefined;
  entry: Entry | null;
  /** The artist an artist-code entry belongs to, resolved by the caller (null: unknown code). */
  codeArtistId?: string | null;
  secret: string | undefined;
};

export async function buildTrace(input: TraceInput): Promise<SubmissionTrace> {
  const { cf, entry } = input;
  const asn = typeof cf?.asn === 'number' && Number.isInteger(cf.asn) ? cf.asn : null;
  return {
    kind: input.kind,
    recordId: input.recordId,
    createdAt: input.now.toISOString(),
    country: text(cf?.country, 8) ?? text(input.headers.get('cf-ipcountry'), 8),
    region: text(cf?.region),
    city: text(cf?.city),
    asn,
    asOrg: text(cf?.asOrganization),
    // Only Cloudflare's own header: x-forwarded-for can be written by the client.
    ipHash: await hashAddress(addressKey(input.headers.get('cf-connecting-ip')), input.secret),
    ...summarizeUserAgent(input.headers.get('user-agent')),
    entryKind: entry?.kind ?? null,
    entryArtistId: entry?.kind === 'host' ? entry.target ?? null : entry?.kind === 'code' ? input.codeArtistId ?? null : null,
    entryEventId: entry?.kind === 'code' ? entry.target ?? null : null,
    entryReferrer: entry?.referrer ?? null,
    entryAt: entry?.at ?? null,
  };
}
