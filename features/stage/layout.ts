import { activePlate, carrierElementId, PLATE_ORDER, type CarrierOrigin, type PlateId, type StageState } from './state';

export type Size = { w: number; h: number };
export type Rect = Size & { x: number; y: number };
export type StageLayout = Record<PlateId, Rect> & Partial<Record<string, Rect>>;

export const STAGE_GAP = 10;
export const STRIP_HEIGHT = 64;
export const EVENT_HEADER_HEIGHT = 120;
export const EVENT_PAGER_HEIGHT = 56;
export const EVENT_ROW_GAP = 6;

function assertSize(stage: Size) {
  if (![stage.w, stage.h].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Stage dimensions must be finite and positive.');
  }
}

export function focusRect(stage: Size): Rect {
  assertSize(stage);
  const railWidth = Math.min(stage.w / 3, Math.max(180, Math.min(240, stage.w * 0.14)));
  const gap = Math.min(STAGE_GAP, stage.w / 10);
  return { x: railWidth + gap, y: 0, w: stage.w - railWidth - gap, h: stage.h };
}

export function eventRowHeight(stage: Size): number { return stage.w < 1280 ? 80 : 92; }

/** Slots, rather than event IDs, keep geometry independent of fetched data. */
export function eventRowRects(stage: Size): Rect[] {
  const focus = focusRect(stage);
  const h = eventRowHeight(stage);
  const available = Math.max(0, focus.h - EVENT_HEADER_HEIGHT - EVENT_PAGER_HEIGHT);
  const count = Math.floor((available + EVENT_ROW_GAP) / (h + EVENT_ROW_GAP));
  const inset = Math.min(20, focus.w / 10);
  return Array.from({ length: count }, (_, index) => ({
    x: focus.x + inset, y: EVENT_HEADER_HEIGHT + index * (h + EVENT_ROW_GAP),
    w: focus.w - inset * 2, h,
  }));
}

export function eventPageSize(stage: Size): number {
  return Math.max(3, eventRowRects(stage).length);
}

/** Pure stage coordinates. Flow layout is deliberately owned by CSS. */
export function computeLayout(state: StageState, stage: Size, carrier?: CarrierOrigin): StageLayout {
  assertSize(stage);
  const { w, h } = stage;
  const gap = Math.min(STAGE_GAP, w / 10, h / 10);
  let layout: StageLayout;
  if (state.view === 'home') {
    const usable = w - 2 * gap;
    const side = Math.min(Math.max(260, usable * 0.23), usable / 3);
    const first = (usable - side) * (47 / 77);
    const middle = usable - side - first;
    const middleX = first + gap;
    const sideX = middleX + middle + gap;
    const half = (h - gap) / 2;
    const sideHeight = h - gap * 2;
    layout = {
      next: { x: 0, y: 0, w: first, h },
      events: { x: middleX, y: 0, w: middle, h: half },
      artists: { x: middleX, y: half + gap, w: middle, h: half },
      about: { x: sideX, y: 0, w: side, h: sideHeight * 0.5 },
      log: { x: sideX, y: sideHeight * 0.5 + gap, w: side, h: sideHeight * 0.32 },
      signal: { x: sideX, y: sideHeight * 0.82 + gap * 2, w: side, h: sideHeight * 0.18 },
    };
  } else {
    const focus = focusRect(stage);
    const railHeight = (h - gap * 5) / 6;
    layout = Object.fromEntries(PLATE_ORDER.map((plate, index) => [plate, {
      x: 0, y: index * (railHeight + gap), w: focus.x - gap, h: railHeight,
    }])) as StageLayout;
    for (const plate of PLATE_ORDER) layout[`rail:${plate}`] = { ...layout[plate] };
    const parent = activePlate(state)!;
    layout[parent] = { ...focus };
    if (state.view !== 'plate') {
      const stripHeight = Math.min(STRIP_HEIGHT, (h - gap) / 2);
      layout[parent].h = stripHeight;
      layout.detail = { ...focus, y: stripHeight + gap, h: h - stripHeight - gap };
    }
    if (parent === 'events') {
      eventRowRects(stage).forEach((rect, index) => { layout[`row:${index}`] = rect; });
    }
  }
  if (carrier) {
    const id = carrierElementId(carrier);
    const isDetail = state.view === 'session'
      ? carrier.kind === 'next-plate' || (carrier.kind === 'event-row' && carrier.id === state.eventId)
      : state.view === 'artist' && carrier.kind === 'artist-cell' && carrier.key === state.artistKey;
    if (isDetail && layout.detail) layout[id] = { ...layout.detail };
    else if (carrier.kind === 'event-row' && state.view === 'plate' && state.plate === 'events') {
      const rect = layout[`row:${carrier.index}`];
      if (rect) layout[id] = { ...rect };
    }
  }
  return layout;
}
