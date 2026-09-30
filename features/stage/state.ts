import { pageNumber } from '@/features/events/model';

export const PLATE_ORDER = ['next', 'events', 'artists', 'log', 'signal', 'about'] as const;
export type PlateId = (typeof PLATE_ORDER)[number];
export type PlateState = 'tile' | 'focus' | 'rail' | 'strip' | 'hidden';
export type StageState =
  | { view: 'home' }
  | { view: 'plate'; plate: PlateId; page: number }
  | { view: 'session'; eventId: string; request: boolean }
  | { view: 'artist'; artistKey: string };

export type CarrierOrigin =
  | { kind: 'event-row'; id: string; index: number }
  | { kind: 'next-plate' }
  | { kind: 'artist-cell'; key: string; index: number };

const routePlates: Record<string, PlateId> = {
  '/events': 'events', '/artists': 'artists', '/transmit': 'log',
  '/signal': 'signal', '/about': 'about',
};

/** Redirects and unknown routes remain owned by the Next route boundary. */
export function stageStateFromUrl(
  pathname: string,
  searchParams: Pick<URLSearchParams, 'get'> = new URLSearchParams(),
): StageState | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { view: 'home' };
  const plate = Object.hasOwn(routePlates, path) ? routePlates[path] : undefined;
  if (plate) return { view: 'plate', plate, page: pageNumber(searchParams.get('page')) };
  const match = /^\/(events|artists)\/([^/]+)(\/request)?$/.exec(path);
  if (!match || (match[1] === 'artists' && match[3])) return null;
  let key: string;
  try { key = decodeURIComponent(match[2]); } catch { return null; }
  return match[1] === 'events'
    ? { view: 'session', eventId: key, request: !!match[3] }
    : { view: 'artist', artistKey: key };
}

export function activePlate(state: StageState): PlateId | null {
  if (state.view === 'home') return null;
  if (state.view === 'plate') return state.plate;
  return state.view === 'session' ? 'events' : 'artists';
}

export function plateState(state: StageState, plate: PlateId): PlateState {
  if (state.view === 'home') return 'tile';
  if (activePlate(state) !== plate) return 'rail';
  return state.view === 'plate' ? 'focus' : 'strip';
}

export function carrierElementId(carrier: CarrierOrigin): string {
  switch (carrier.kind) {
    case 'event-row': return `event:${carrier.id}`;
    case 'artist-cell': return `artist:${carrier.key}`;
    case 'next-plate': return 'next';
  }
}
