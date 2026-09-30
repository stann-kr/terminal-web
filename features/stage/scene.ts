import type { Rect, StageLayout } from './layout';
import type { PlateId, StageState } from './state';
import { DIRECTORY_PAGE_SIZE, directoryPages } from './links';

/**
 * What the stage presents for a URL once data is known. `layout` is the state handed to
 * `computeLayout`; `doc` marks scenes whose focus area still shows the route's own page (S1).
 */
export type Scene =
  | { kind: 'home'; layout: StageState; doc: false }
  | { kind: 'directory'; layout: StageState; page: number; doc: false; missing?: { eventId: string; reason: 'pending' | 'absent' } }
  | { kind: 'session'; layout: StageState; eventId: string; request: boolean; doc: boolean }
  | { kind: 'plate'; layout: StageState; plate: PlateId; doc: true }
  | { kind: 'artist'; layout: StageState; doc: true }
  | { kind: 'document'; layout: StageState; doc: true };

/** Every plate folds into the rail when a route boundary (404, error) owns the page. */
export const RAIL_ONLY: StageState = { view: 'plate', plate: 'events', page: 1 };

export function buildScene(
  state: StageState | null,
  { takeover, eventIds }: { takeover: boolean; eventIds: readonly string[] | undefined },
): Scene {
  if (!state || takeover) return { kind: 'document', layout: RAIL_ONLY, doc: true };
  if (state.view === 'home') return { kind: 'home', layout: state, doc: false };
  if (state.view === 'artist') return { kind: 'artist', layout: state, doc: true };
  if (state.view === 'plate') {
    if (state.plate !== 'events') return { kind: 'plate', layout: state, plate: state.plate, doc: true };
    const page = Math.min(state.page, directoryPages(eventIds?.length ?? 0));
    return { kind: 'directory', layout: state, page, doc: false };
  }
  // A session needs its record: until it is known (or when it does not exist) the directory
  // stays open and says so, with the same wording and status code as before the stage.
  if (!eventIds || !eventIds.includes(state.eventId)) {
    return {
      kind: 'directory', layout: { view: 'plate', plate: 'events', page: 1 }, page: 1, doc: false,
      missing: { eventId: state.eventId, reason: eventIds ? 'absent' : 'pending' },
    };
  }
  return { kind: 'session', layout: state, eventId: state.eventId, request: state.request, doc: state.request };
}

export type CarrierMode = 'cell' | 'row' | 'detail' | 'hidden';
export type CarrierPlacement = { mode: CarrierMode; face: 'cell' | 'row'; rect: Rect; slot: number };

/** Session cells on the home EVENTS tile, between its title bar and its counters. */
export const HOME_CELLS = { top: 68, bottom: 96, height: 50, gap: 6, inset: 22, max: 3 } as const;

export function homeCellRects(tile: Rect): Rect[] {
  const { top, bottom, height, gap, inset, max } = HOME_CELLS;
  const room = tile.h - top - bottom;
  const count = Math.max(0, Math.min(max, Math.floor((room + gap) / (height + gap))));
  return Array.from({ length: count }, (_, index) => ({
    x: tile.x + inset, y: tile.y + top + index * (height + gap), w: Math.max(0, tile.w - inset * 2), h: height,
  }));
}

export function rowRects(layout: StageLayout): Rect[] {
  const rows: Rect[] = [];
  for (let index = 0; layout[`row:${index}`]; index++) rows.push(layout[`row:${index}`]!);
  return rows;
}

const nudge = (rect: Rect, dy: number): Rect => ({ ...rect, y: rect.y + dy });
/** A plate-sized rect shrunk to a line near its middle: where hidden records wait. */
const tuck = (rect: Rect): Rect => ({ x: rect.x + 12, y: rect.y + Math.max(0, rect.h / 2 - 12), w: Math.max(0, rect.w - 24), h: Math.min(24, rect.h) });

/**
 * Places every event record for a scene. Records never leave the carrier list; they move
 * between cell, row and detail rects, or wait hidden where they will reappear.
 */
export function placeEventCarriers(scene: Scene, layout: StageLayout, ids: readonly string[]): Map<string, CarrierPlacement> {
  const placements = new Map<string, CarrierPlacement>();
  const parent = layout['rail:events'] && scene.kind !== 'directory' && scene.kind !== 'session' ? layout['rail:events']! : layout.events;
  if (scene.kind === 'home') {
    const cells = homeCellRects(layout.events);
    const fallback = cells.at(-1) ?? tuck(layout.events);
    ids.forEach((id, index) => placements.set(id, index < cells.length
      ? { mode: 'cell', face: 'cell', rect: cells[index], slot: index }
      : { mode: 'hidden', face: 'cell', rect: nudge(fallback, 12), slot: index }));
    return placements;
  }
  if (scene.kind === 'directory') {
    const rows = rowRects(layout);
    const fallback = rows.at(-1) ?? tuck(layout.events);
    const start = (scene.page - 1) * DIRECTORY_PAGE_SIZE;
    ids.forEach((id, index) => {
      const slot = index - start;
      const home = rows[((index % DIRECTORY_PAGE_SIZE) + DIRECTORY_PAGE_SIZE) % DIRECTORY_PAGE_SIZE] ?? fallback;
      const visible = !scene.missing && slot >= 0 && slot < DIRECTORY_PAGE_SIZE;
      placements.set(id, visible
        ? { mode: 'row', face: 'row', rect: rows[slot] ?? fallback, slot }
        : { mode: 'hidden', face: 'row', rect: nudge(home, slot < 0 ? -12 : 12), slot: 0 });
    });
    return placements;
  }
  if (scene.kind === 'session') {
    const detail = layout[`event:${scene.eventId}`] ?? layout.detail ?? layout.events;
    ids.forEach(id => placements.set(id, id === scene.eventId
      ? { mode: scene.request ? 'hidden' : 'detail', face: 'row', rect: detail, slot: 0 }
      : { mode: 'hidden', face: 'row', rect: tuck(layout.events), slot: 0 }));
    return placements;
  }
  ids.forEach(id => placements.set(id, { mode: 'hidden', face: 'cell', rect: tuck(parent), slot: 0 }));
  return placements;
}
