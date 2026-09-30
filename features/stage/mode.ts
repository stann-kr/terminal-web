import type { Size } from './layout';

export type StageMode = 'stage' | 'flow';
export const STAGE_MIN_WIDTH = 1024;
export const STAGE_MIN_HEIGHT = 680;
export const STAGE_REENTRY_MARGIN = 24;

/** Leave immediately on overflow; re-enter only with room to avoid oscillation. */
export function resolveStageMode({
  viewport, availableHeight, minContentHeight, previousMode,
}: {
  viewport: Size;
  availableHeight: number;
  minContentHeight: number;
  previousMode?: StageMode;
}): StageMode {
  if (![viewport.w, viewport.h, availableHeight, minContentHeight].every(Number.isFinite)
    || availableHeight <= 0 || minContentHeight < 0) return 'flow';
  const margin = previousMode === 'flow' ? STAGE_REENTRY_MARGIN : 0;
  return viewport.w >= STAGE_MIN_WIDTH + margin
    && viewport.h >= STAGE_MIN_HEIGHT + margin
    && availableHeight >= minContentHeight + margin ? 'stage' : 'flow';
}
