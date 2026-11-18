import { PLATE_ORDER, type PlateId } from './state';

/**
 * How much of itself a plate shows. `hero` is the open plate; `panel` and `tile` are summaries with
 * room for cells; `index` is a narrow list beside an open detail; `chip` is a name to press.
 */
export type Density = 'hero' | 'panel' | 'tile' | 'index' | 'chip';

/** A layout is a tiling: splits side by side (`row`) or stacked (`col`), each part with a weight. */
export type LayoutLeaf = { plate: PlateId; density: Density } | { slot: 'detail' } | { slot: 'back' } | { slot: 'home' };
/** `gap` overrides the stage gap between this node's parts. A negative weight is a fixed size in px. */
export type LayoutNode = { dir: 'row' | 'col'; parts: [number, LayoutNode | LayoutLeaf][]; gap?: number };
export type ViewName = 'home' | 'events' | 'session' | 'artists' | 'artist' | 'log' | 'signal' | 'about' | 'merch';

const row = (...parts: [number, LayoutNode | LayoutLeaf][]): LayoutNode => ({ dir: 'row', parts });
const col = (...parts: [number, LayoutNode | LayoutLeaf][]): LayoutNode => ({ dir: 'col', parts });
const p = (plate: PlateId, density: Density): LayoutLeaf => ({ plate, density });
const DETAIL: LayoutLeaf = { slot: 'detail' };
const BACK: LayoutLeaf = { slot: 'back' };
const HOME: LayoutLeaf = { slot: 'home' };

export interface StageConfig {
  /** One tiling per view. Every view places every plate; details add the detail, others the back card. */
  layouts: Record<ViewName, LayoutNode>;
  /**
   * A view's order on a narrow stage (a phone), where each top-level part of the tiling becomes a
   * sheet, the open plate's first: the same leaves, parts in the order to read them. Views without
   * one keep their own order.
   */
  narrow: Partial<Record<ViewName, LayoutNode>>;
  /**
   * Each view's focal plate carries the concentric rings (an ambient drift that leans after the
   * pointer): where they sit (`plate`, or the open `detail`) and their home centre as fractions of it.
   */
  rings: Partial<Record<ViewName, { plate: PlateId | 'detail'; at: { x: number; y: number } }>>;
  /** Where the plate chips sit in flow (scrolling) mode. */
  flowChips: 'top' | 'bottom';
  /** Frame padding around the stage, px. */
  frameY: number;
  /**
   * A desktop window (at least `w` wide) needs at least `h` of height for the tilings; below it the
   * stage asks for a taller window instead (with a way to go on anyway). Narrow windows use sheets.
   */
  minDesktop: { w: number; h: number };
}

/**
 * The stage's design decisions, in one place. Each view has its own arrangement, so moving between
 * views re-tiles every plate; try another arrangement by editing its tree here.
 */
const homeNext: [number, LayoutLeaf] = [47, p('next', 'hero')];
const homeDirectory: [number, LayoutNode] = [30, col([50, p('events', 'panel')], [50, p('artists', 'panel')])];
const homeCalls: [number, LayoutNode] = [23, col([22, p('instagram', 'tile')], [18, p('signal', 'panel')], [18, p('merch', 'tile')], [18, p('log', 'panel')], [24, p('about', 'tile')])];

/**
 * An open view's band: the way back, then every other plate as a chip, in plate order. The band
 * sits over the open plate (or detail), which takes the whole width below it.
 */
const band = (...chips: PlateId[]): [number, LayoutNode] => [
  -87,
  { dir: 'row', gap: 6, parts: [[-220, BACK], ...chips.map((id): [number, LayoutLeaf] => [1, p(id, 'chip')]), [-82, HOME]] },
];
const others = (...open: PlateId[]) => PLATE_ORDER.filter(id => !open.includes(id));

export const stageConfig: StageConfig = {
  layouts: {
    // The next session leads; directory and roster in the middle; the account and the call to subscribe high on the right.
    home: row(homeNext, homeDirectory, homeCalls),
    // Every open view: the band of the other plates on top, the open plate the full width below.
    events: col(band(...others('events')), [1, p('events', 'hero')]),
    artists: col(band(...others('artists')), [1, p('artists', 'hero')]),
    // A session stands in for the next plate and an artist file for the roster; the band keeps the rest.
    session: col(band(...others('next')), [1, DETAIL]),
    artist: col(band(...others('artists')), [1, DETAIL]),
    log: col(band(...others('log')), [1, p('log', 'hero')]),
    signal: col(band(...others('signal')), [1, p('signal', 'hero')]),
    about: col(band(...others('about')), [1, p('about', 'hero')]),
    merch: col(band(...others('merch')), [1, p('merch', 'hero')]),
  },
  narrow: {
    // On a phone the account and the call to subscribe come right after the next session, before
    // the directory and the roster: most visitors arrive by phone (the event's QR stickers).
    home: row(homeNext, homeCalls, homeDirectory),
  },
  rings: {
    home: { plate: 'next', at: { x: 0.86, y: 0.3 } },
    session: { plate: 'detail', at: { x: 0.16, y: 0.3 } },
    artist: { plate: 'detail', at: { x: 0.14, y: 0.35 } },
    signal: { plate: 'signal', at: { x: 0.82, y: 0.17 } },
  },
  flowChips: 'top',
  frameY: 10,
  minDesktop: { w: 1024, h: 600 },
};
