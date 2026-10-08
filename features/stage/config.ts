import type { PlateId } from './state';

/**
 * How much of itself a plate shows. `hero` is the open plate; `panel` and `tile` are summaries with
 * room for cells; `index` is a narrow list beside an open detail; `chip` is a name to press.
 */
export type Density = 'hero' | 'panel' | 'tile' | 'index' | 'chip';

/** A layout is a tiling: splits side by side (`row`) or stacked (`col`), each part with a weight. */
export type LayoutLeaf = { plate: PlateId; density: Density } | { slot: 'detail' } | { slot: 'back' };
export type LayoutNode = { dir: 'row' | 'col'; parts: [number, LayoutNode | LayoutLeaf][] };
export type ViewName = 'home' | 'events' | 'session' | 'artists' | 'artist' | 'log' | 'signal' | 'about';

const row = (...parts: [number, LayoutNode | LayoutLeaf][]): LayoutNode => ({ dir: 'row', parts });
const col = (...parts: [number, LayoutNode | LayoutLeaf][]): LayoutNode => ({ dir: 'col', parts });
const p = (plate: PlateId, density: Density): LayoutLeaf => ({ plate, density });
const DETAIL: LayoutLeaf = { slot: 'detail' };
const BACK: LayoutLeaf = { slot: 'back' };

export interface StageConfig {
  /** One tiling per view. Every view places all six plates; details add the detail, others the back card. */
  layouts: Record<ViewName, LayoutNode>;
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
export const stageConfig: StageConfig = {
  layouts: {
    // The next session leads; directory and roster in the middle; the call to subscribe high on the right.
    home: row(
      [47, p('next', 'hero')],
      [30, col([50, p('events', 'panel')], [50, p('artists', 'panel')])],
      [23, col([26, p('signal', 'panel')], [48, p('log', 'panel')], [26, p('about', 'tile')])],
    ),
    // The directory opens wide on the right; the way back, the next session and the roster step left.
    events: row(
      [30, col([15, BACK], [43, p('next', 'panel')], [42, p('artists', 'panel')])],
      [70, col([86, p('events', 'hero')], [14, row([1, p('log', 'chip')], [1, p('signal', 'chip')], [1, p('about', 'chip')])])],
    ),
    // The roster mirrors the directory: wide on the left, the rest in a column on the right.
    artists: row(
      [70, col([86, p('artists', 'hero')], [14, row([1, p('log', 'chip')], [1, p('signal', 'chip')], [1, p('about', 'chip')])])],
      [30, col([15, BACK], [40, p('next', 'panel')], [45, p('events', 'panel')])],
    ),
    // A session: the other sessions as an index on the left, the file beside it, a band of plates on top.
    session: col(
      [13, row([18, BACK], [22, p('next', 'chip')], [15, p('artists', 'chip')], [15, p('log', 'chip')], [15, p('signal', 'chip')], [15, p('about', 'chip')])],
      [87, row([21, p('events', 'index')], [79, DETAIL])],
    ),
    // An artist file mirrors it: the file with the roster index on the right, the band below.
    artist: col(
      [87, row([78, DETAIL], [22, p('artists', 'index')])],
      [13, row([18, BACK], [22, p('next', 'chip')], [15, p('events', 'chip')], [15, p('log', 'chip')], [15, p('signal', 'chip')], [15, p('about', 'chip')])],
    ),
    // The log sits in the middle between the session side and the rest.
    log: row(
      [25, col([15, BACK], [35, p('next', 'tile')], [50, p('events', 'panel')])],
      [50, p('log', 'hero')],
      [25, col([40, p('signal', 'panel')], [30, p('artists', 'chip')], [30, p('about', 'chip')])],
    ),
    // Subscribing sits beside the session it is about.
    signal: row(
      [28, col([15, BACK], [85, p('next', 'panel')])],
      [50, p('signal', 'hero')],
      [22, col([1, p('events', 'chip')], [1, p('artists', 'chip')], [1, p('log', 'chip')], [1, p('about', 'chip')])],
    ),
    // About leads wide; the roster and the rest in a column.
    about: row(
      [64, p('about', 'hero')],
      [36, col([15, BACK], [27, p('next', 'tile')], [38, p('artists', 'panel')], [20, row([1, p('events', 'chip')], [1, p('log', 'chip')], [1, p('signal', 'chip')])])],
    ),
  },
  rings: {
    home: { plate: 'next', at: { x: 0.86, y: 0.3 } },
    events: { plate: 'next', at: { x: 0.8, y: 0.35 } },
    artists: { plate: 'next', at: { x: 0.8, y: 0.35 } },
    session: { plate: 'detail', at: { x: 0.16, y: 0.3 } },
    artist: { plate: 'detail', at: { x: 0.14, y: 0.35 } },
    log: { plate: 'signal', at: { x: 0.82, y: 0.3 } },
    signal: { plate: 'next', at: { x: 0.8, y: 0.3 } },
    about: { plate: 'next', at: { x: 0.8, y: 0.4 } },
  },
  flowChips: 'top',
  frameY: 10,
  minDesktop: { w: 1024, h: 600 },
};
