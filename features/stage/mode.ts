/**
 * `stage` pins the plates to the window and pages long content; `flow` is the document-scroll
 * safety net. Clipping is never an option.
 */
export type StageMode = 'stage' | 'flow';

export const STAGE_MIN_W = 1024;
export const STAGE_MIN_H = 680;
/** Slack at each boundary, so a window resting on it does not flip between modes. */
export const MODE_HYSTERESIS = 24;

export interface ModeInput {
  viewport: { w: number; h: number };
  /** Smallest height the open plate's content needs (head, pager, one unit), and what it was given. */
  fit?: { required: number; available: number } | null;
  /** Layout found a shown element outside the stage. */
  layoutFits?: boolean;
}

/**
 * The limits always hold: below them, or with content that does not fit, the answer is `flow` at
 * once. The slack only applies on the way back, so a flow window has to clear every limit by
 * `MODE_HYSTERESIS` before it returns to the stage.
 */
export function decideStageMode(input: ModeInput, previous: StageMode | null = null): StageMode {
  const { viewport, fit, layoutFits = true } = input;
  const slack = previous === 'flow' ? MODE_HYSTERESIS : 0;
  if (!layoutFits) return 'flow';
  if (fit && fit.required + slack > fit.available) return 'flow';
  return viewport.w >= STAGE_MIN_W + slack && viewport.h >= STAGE_MIN_H + slack ? 'stage' : 'flow';
}
