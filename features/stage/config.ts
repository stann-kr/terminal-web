import type { PlateId } from './state';

export interface StageConfig {
  /**
   * Home: columns left to right, each a width weight and its plates top to bottom with height
   * weights. The last column never gets narrower than `sideMinW`; the others give way instead.
   */
  home: { columns: { width: number; plates: [PlateId, number][] }[]; sideMinW: number };
  /** Rail side while a plate is open. */
  railSide: 'left' | 'right';
  /** Rail width: clamp(min, vw × viewport width, max). */
  railWidth: { min: number; vw: number; max: number };
  /** A detail keeps its parent plate as a strip above it; false leaves the parent in the rail. */
  detailStrip: boolean;
  /** The schedule ticker under the stage. */
  ticker: boolean;
  /** Concentric rings behind the next-session plate (an ambient drift, not a beat). */
  rings: boolean;
  /** Where the plate chips sit in flow (scrolling) mode. */
  flowChips: 'top' | 'bottom';
  /** Fixed bar heights in px; the shell hands the same values to CSS as variables. */
  statusH: number;
  tickerH: number;
  /** Frame padding above the status line and below the ticker. */
  frameY: number;
}

/**
 * The stage's open design decisions, in one place. Layout, the shell and the CSS variables all
 * follow these, so trying another answer is an edit here, not a refactor.
 */
export const stageConfig: StageConfig = {
  // Signal sits high in the side column: subscribing is an action, not background.
  home: {
    columns: [
      { width: 47, plates: [['next', 1]] },
      { width: 30, plates: [['events', 50], ['artists', 50]] },
      { width: 23, plates: [['signal', 26], ['log', 48], ['about', 26]] },
    ],
    sideMinW: 260,
  },
  railSide: 'left',
  railWidth: { min: 180, vw: 0.14, max: 240 },
  detailStrip: true,
  ticker: true,
  rings: true,
  flowChips: 'top',
  statusH: 56,
  tickerH: 28,
  frameY: 10,
};
