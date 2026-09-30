import { PLATE_ORDER, carrierId, parentPlate, type Carrier, type PlateId, type StageState } from './state';

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
/** `detail` is a plate standing in for a detail it carried (the NEXT plate growing into SESSION). */
export type PlateMode = 'tile' | 'focus' | 'rail' | 'strip' | 'detail' | 'hidden';

/** Kinds of list items the stage lays out itself, and the plate each one belongs to. */
export type ItemKind = 'event-row' | 'artist-cell';
const ITEM_PARENT: Record<ItemKind, PlateId> = { 'event-row': 'events', 'artist-cell': 'artists' };

/** Sizes in px. The fluid ones follow the same clamps as the CSS tokens of the same role. */
export interface StageMetrics {
  gap: number;
  pad: number;
  railW: number;
  stripH: number;
  /** Plate head above a list or grid (title, counts, summary chips). */
  listHead: number;
  /** Page indicator and previous/next keys under a list or grid. */
  pagerH: number;
  rowH: number;
  rowGap: number;
  cellMinW: number;
  cellH: number;
  /** Narrowest the third home column may get before the first two give way. */
  sideMinW: number;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export function stageMetrics(viewportW: number): StageMetrics {
  return {
    gap: clamp(8, viewportW * 0.007, 12), // --gap
    pad: clamp(16, viewportW * 0.015, 28), // --pad
    railW: clamp(180, viewportW * 0.14, 240),
    stripH: 64,
    listHead: 120,
    pagerH: 56,
    rowH: viewportW < 1280 ? 80 : 92,
    rowGap: 6,
    cellMinW: 200,
    cellH: 128,
    sideMinW: 260,
  };
}

export interface LayoutInput {
  /** The list items mounted on the stage for the current page, in list order. */
  items?: { kind: ItemKind; ids: readonly string[] };
  /** The element that grows into the open detail, if one was recorded. */
  carrier?: Carrier | null;
  /** Defaults to the stage width; the rail and fluid gaps follow the viewport like the CSS does. */
  viewportW?: number;
  metrics?: Partial<StageMetrics>;
}

export interface PlacedItem {
  rect: Rect;
  /** Collapsed items sit folded into their parent plate and are not shown. */
  visible: boolean;
}

export interface StageLayout {
  plates: Record<PlateId, { mode: PlateMode; rect: Rect }>;
  /** Fixed rail slots, present whenever the rail is. A slot whose plate is elsewhere shows as open. */
  rail: Record<PlateId, Rect> | null;
  openSlots: PlateId[];
  /** The work area right of the rail (focus plate, or strip plus detail). */
  focus: Rect | null;
  detail: { rect: Rect; carrierId: string | null } | null;
  /** Keyed by carrier id (`event-row:TRM-02`), so a row and the detail it grows into share a key. */
  items: Record<string, PlacedItem>;
  /** Items per page for the focused list or grid, or null when nothing pages by layout. */
  perPage: number | null;
  /** False when a shown element would leave the stage: the stage mode must fall back to flow. */
  fits: boolean;
}

// Rects are built from rounded edges, so neighbours share an exact edge and never overlap by a
// sub-pixel.
const edges = (x0: number, y0: number, x1: number, y1: number): Rect => {
  const x = Math.round(x0);
  const y = Math.round(y0);
  return { x, y, w: Math.round(x1) - x, h: Math.round(y1) - y };
};

/** Splits `length` into parts by weight, with `gap` between them. Returns [start, end] pairs. */
function split(start: number, length: number, weights: readonly number[], gap: number): [number, number][] {
  const free = length - gap * (weights.length - 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const out: [number, number][] = [];
  let cursor = start;
  weights.forEach((weight, index) => {
    const end = index === weights.length - 1 ? start + length : cursor + (free * weight) / total;
    out.push([cursor, end]);
    cursor = end + gap;
  });
  return out;
}

function homeRects(stage: Size, m: StageMetrics): Record<PlateId, Rect> {
  const free = stage.w - 2 * m.gap;
  let side = free * 0.23;
  let [main, middle] = [free * 0.47, free * 0.3];
  if (side < m.sideMinW) {
    side = Math.min(m.sideMinW, free * 0.4);
    const rest = free - side;
    [main, middle] = [(rest * 47) / 77, (rest * 30) / 77];
  }
  const [c1, c2, c3] = split(0, stage.w, [main, middle, side], m.gap);
  const [events, artists] = split(0, stage.h, [50, 50], m.gap);
  const [about, log, signal] = split(0, stage.h, [50, 32, 18], m.gap);
  return {
    next: edges(c1[0], 0, c1[1], stage.h),
    events: edges(c2[0], events[0], c2[1], events[1]),
    artists: edges(c2[0], artists[0], c2[1], artists[1]),
    about: edges(c3[0], about[0], c3[1], about[1]),
    log: edges(c3[0], log[0], c3[1], log[1]),
    signal: edges(c3[0], signal[0], c3[1], signal[1]),
  };
}

function railRects(stage: Size, m: StageMetrics): Record<PlateId, Rect> {
  const slots = split(0, stage.h, PLATE_ORDER.map(() => 1), m.gap);
  return Object.fromEntries(PLATE_ORDER.map((id, index) => [id, edges(0, slots[index][0], m.railW, slots[index][1])])) as Record<PlateId, Rect>;
}

/** Rows fill the plate below its head; how many fit decides the page size (at least three). */
export function listRowsPerPage(areaH: number, m: StageMetrics): number {
  return Math.max(3, Math.floor((areaH - m.listHead - m.pagerH + m.rowGap) / (m.rowH + m.rowGap)));
}

function listLayout(area: Rect, count: number, m: StageMetrics): { rects: Rect[]; perPage: number } {
  const perPage = listRowsPerPage(area.h, m);
  const rects = Array.from({ length: Math.min(count, perPage) }, (_, index) => {
    const y = area.y + m.listHead + index * (m.rowH + m.rowGap);
    return edges(area.x + m.pad, y, area.x + area.w - m.pad, y + m.rowH);
  });
  return { rects, perPage };
}

function gridLayout(area: Rect, count: number, m: StageMetrics): { rects: Rect[]; perPage: number } {
  const innerW = area.w - 2 * m.pad;
  const cols = Math.max(1, Math.floor((innerW + m.gap) / (m.cellMinW + m.gap)));
  const rows = Math.max(1, Math.floor((area.h - m.listHead - m.pagerH + m.gap) / (m.cellH + m.gap)));
  const columns = split(area.x + m.pad, innerW, Array.from({ length: cols }, () => 1), m.gap);
  const rects = Array.from({ length: Math.min(count, cols * rows) }, (_, index) => {
    const [x0, x1] = columns[index % cols];
    const y = area.y + m.listHead + Math.floor(index / cols) * (m.cellH + m.gap);
    return edges(x0, y, x1, y + m.cellH);
  });
  return { rects, perPage: cols * rows };
}

const inside = (rect: Rect, stage: Size) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= stage.w && rect.y + rect.h <= stage.h;

/**
 * Where every plate and stage-level item sits for a state. Pure and deterministic: it reads no DOM,
 * so the same state and stage size always give the same rects.
 */
export function computeLayout(state: StageState, stage: Size, input: LayoutInput = {}): StageLayout {
  const m = { ...stageMetrics(input.viewportW ?? stage.w), ...input.metrics };
  const home = homeRects(stage, m);
  const parent = parentPlate(state);
  const plates = {} as StageLayout['plates'];
  const items: Record<string, PlacedItem> = {};
  let rail: StageLayout['rail'] = null;
  let focus: Rect | null = null;
  let detail: StageLayout['detail'] = null;
  let perPage: number | null = null;

  if (state.view === 'home' || state.view === 'none' || !parent) {
    const mode: PlateMode = state.view === 'home' ? 'tile' : 'hidden';
    for (const id of PLATE_ORDER) plates[id] = { mode, rect: home[id] };
  } else {
    rail = railRects(stage, m);
    focus = edges(m.railW + m.gap, 0, stage.w, stage.h);
    for (const id of PLATE_ORDER) plates[id] = { mode: 'rail', rect: rail[id] };

    if (state.view === 'plate') {
      plates[parent] = { mode: 'focus', rect: focus };
    } else {
      const strip = edges(focus.x, 0, focus.x + focus.w, m.stripH);
      const body = edges(focus.x, m.stripH + m.gap, focus.x + focus.w, stage.h);
      plates[parent] = { mode: 'strip', rect: strip };
      const carrier = input.carrier ?? null;
      detail = { rect: body, carrierId: carrier ? carrierId(carrier) : null };
      if (carrier?.kind === 'next-plate') plates.next = { mode: 'detail', rect: body };
    }
  }

  if (input.items) {
    const { kind, ids } = input.items;
    const owner = ITEM_PARENT[kind];
    const ownerPlate = plates[owner];
    const laid =
      ownerPlate.mode === 'focus'
        ? kind === 'event-row'
          ? listLayout(ownerPlate.rect, ids.length, m)
          : gridLayout(ownerPlate.rect, ids.length, m)
        : null;
    if (laid) perPage = laid.perPage;
    ids.forEach((id, index) => {
      const key = `${kind}:${id}`;
      if (detail && detail.carrierId === key) items[key] = { rect: detail.rect, visible: true };
      else if (laid && index < laid.rects.length) items[key] = { rect: laid.rects[index], visible: true };
      else items[key] = { rect: ownerPlate.rect, visible: false };
    });
  }

  const openSlots = rail ? PLATE_ORDER.filter(id => plates[id].mode !== 'rail') : [];
  const shown = [
    ...PLATE_ORDER.filter(id => plates[id].mode !== 'hidden').map(id => plates[id].rect),
    ...Object.values(items).filter(item => item.visible).map(item => item.rect),
  ];
  const fits = shown.every(rect => inside(rect, stage) && rect.w > 0 && rect.h > 0);

  return { plates, rail, openSlots, focus, detail, items, perPage, fits };
}
