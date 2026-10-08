import { pageNumber } from '@/features/events/model';
import { instagram } from '@/features/about/instagram';

/** The top-level plates in document order: the home's reading order (columns left to right, each top to bottom), which keyboard and screen readers follow. */
export const PLATE_ORDER = ['next', 'events', 'artists', 'instagram', 'signal', 'log', 'about'] as const;
export type PlateId = (typeof PLATE_ORDER)[number];

/** Where a detail was asked for from, but that id is not in the loaded data. */
export type Missing = { kind: 'event' | 'artist'; id: string };

export type StageState =
  | { view: 'home' }
  | { view: 'plate'; plate: PlateId; page: number; missing?: Missing }
  | { view: 'session'; eventId: string; request: boolean }
  | { view: 'artist'; artistKey: string }
  /** Outside the stage: not-found pages and anything the app does not route to a plate. */
  | { view: 'none' };

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

const PLATE_PATHS: Record<string, PlateId> = {
  events: 'events',
  artists: 'artists',
  transmit: 'log',
  signal: 'signal',
  about: 'about',
};

function readParam(search: SearchInput, name: string): string | null {
  if (!search) return null;
  if (search instanceof URLSearchParams) return search.get(name);
  const value = search[name];
  return typeof value === 'string' ? value : null;
}

function decodeSegment(segment: string): string | null {
  try {
    const value = decodeURIComponent(segment);
    return value ? value : null;
  } catch {
    return null;
  }
}

/**
 * The address alone decides the stage. Paging only applies to plates that page and a malformed page
 * number reads as the first page. A detail id that cannot be decoded is the route's own not-found
 * page, so it is off the stage.
 */
export function stageStateFromUrl(pathname: string, search?: SearchInput): StageState {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'home' };
  const plate = PLATE_PATHS[parts[0]];
  if (!plate) return { view: 'none' };
  const page = pageNumber(readParam(search, 'page'));

  if (parts.length === 1) {
    return { view: 'plate', plate, page: plate === 'events' || plate === 'artists' || plate === 'log' ? page : 1 };
  }
  if (plate === 'events' && (parts.length === 2 || (parts.length === 3 && parts[2] === 'request'))) {
    const eventId = decodeSegment(parts[1]);
    return eventId ? { view: 'session', eventId, request: parts.length === 3 } : { view: 'none' };
  }
  if (plate === 'artists' && parts.length === 2) {
    const artistKey = decodeSegment(parts[1]);
    return artistKey ? { view: 'artist', artistKey } : { view: 'none' };
  }
  return { view: 'none' };
}

/**
 * Once data has loaded, a detail whose id is unknown becomes its parent plate with an error
 * notice inside it. Pass `null` for a catalogue that has not loaded yet: nothing is demoted then.
 */
export function resolveMissing(
  state: StageState,
  known: { eventIds: ReadonlySet<string> | null; artistKeys: ReadonlySet<string> | null },
): StageState {
  if (state.view === 'session' && known.eventIds && !known.eventIds.has(state.eventId)) {
    return { view: 'plate', plate: 'events', page: 1, missing: { kind: 'event', id: state.eventId } };
  }
  if (state.view === 'artist' && known.artistKeys && !known.artistKeys.has(state.artistKey)) {
    return { view: 'plate', plate: 'artists', page: 1, missing: { kind: 'artist', id: state.artistKey } };
  }
  return state;
}

/** Where each plate opens; the Instagram plate opens the profile itself. */
export const PLATE_HREF: Record<PlateId, string> = {
  next: '/',
  events: '/events',
  artists: '/artists',
  log: '/transmit',
  signal: '/signal',
  about: '/about',
  instagram: instagram.url,
};

/** The address of a state (the inverse of `stageStateFromUrl` for stage views). */
export function stateHref(state: StageState): string {
  switch (state.view) {
    case 'plate':
      return `${PLATE_HREF[state.plate]}${state.page > 1 ? `?page=${state.page}` : ''}`;
    case 'session':
      return `/events/${encodeURIComponent(state.eventId)}${state.request ? '/request' : ''}`;
    case 'artist':
      return `/artists/${encodeURIComponent(state.artistKey)}`;
    default:
      return '/';
  }
}

/** A stable key per distinct view (paging included), for effects that run once per view. */
export function stateKey(state: StageState): string {
  switch (state.view) {
    case 'plate':
      return `plate:${state.plate}:${state.page}${state.missing ? `:missing:${state.missing.id}` : ''}`;
    case 'session':
      return `session:${state.eventId}${state.request ? ':request' : ''}`;
    case 'artist':
      return `artist:${state.artistKey}`;
    default:
      return state.view;
  }
}

/**
 * The scene a state belongs to: the state without its list page or the session's request form.
 * Turning a page or opening the form inside a session is the same scene, so the page keeps its
 * scroll; a new scene starts at its top.
 */
export function sceneKey(state: StageState): string {
  if (state.view === 'plate') return `plate:${state.plate}${state.missing ? `:missing:${state.missing.id}` : ''}`;
  if (state.view === 'session') return `session:${state.eventId}`;
  return stateKey(state);
}

/** One level up (detail → parent plate → home): where the back card leads when there is no earlier view. */
export function stageParentHref(state: StageState): string | null {
  if (state.view === 'session') return state.request ? `/events/${encodeURIComponent(state.eventId)}` : '/events';
  if (state.view === 'artist') return '/artists';
  if (state.view === 'plate') return '/';
  return null;
}

// ─── Carrier memory ────────────────────────────────────────────────────────────────────────────
// Every event and artist has one element on the stage that grows into its detail. When the click
// that opens a detail starts somewhere else (the next-session plate, a lineup slot, a record row),
// the click records that spot so the element can set out from it. The next state takes it once.

export type CarrierKind = 'event' | 'artist';
export type OriginRect = { x: number; y: number; w: number; h: number };
export interface Carrier {
  kind: CarrierKind;
  id: string;
  /** Where the click happened, in stage coordinates; null when the element itself was clicked. */
  rect: OriginRect | null;
}

/** Stable element id of a carrier, shared by every shape it takes (cell, row, detail). */
export const carrierKey = (kind: CarrierKind, id: string) => `${kind}:${id}`;

/** Reads the `data-carrier="event:TRM-02"` mark put on links that open a detail. */
export function parseCarrierMark(mark: string | null | undefined): { kind: CarrierKind; id: string } | null {
  const match = /^(event|artist):(.+)$/.exec(mark ?? '');
  return match ? { kind: match[1] as CarrierKind, id: match[2] } : null;
}

/** A carrier only counts for the detail it was recorded for, so a stale record never grows. */
export function carrierMatches(carrier: Pick<Carrier, 'kind' | 'id'>, state: StageState): boolean {
  if (state.view === 'session') return carrier.kind === 'event' && carrier.id === state.eventId;
  if (state.view === 'artist') return carrier.kind === 'artist' && carrier.id === state.artistKey;
  return false;
}

let pending: Carrier | null = null;

export const stageOrigin = {
  record(carrier: Carrier) {
    pending = carrier;
  },
  /** Returns the recorded carrier if it belongs to `state`, and forgets it either way. */
  take(state: StageState): Carrier | null {
    const carrier = pending;
    pending = null;
    return carrier && carrierMatches(carrier, state) ? carrier : null;
  },
};
