import { stageConfig, type StageConfig } from './config';
import { PLATE_ORDER, carrierKey, parentPlate, type CarrierKind, type PlateId, type StageState } from './state';

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type PlateMode = 'tile' | 'focus' | 'rail' | 'strip' | 'hidden';
/** A carrier is a cell on its home plate, a row (or grid cell) of its open list, the open detail, or folded away. */
export type ItemMode = 'cell' | 'row' | 'detail' | 'folded';

/** The plate each kind of carrier belongs to. */
export const ITEM_OWNER: Record<CarrierKind, PlateId> = { event: 'events', artist: 'artists' };

/** Sizes in px. The fluid ones follow the same clamps as the CSS tokens of the same role. */
export interface StageMetrics {
  gap: number;
  pad: number;
  railW: number;
  stripH: number;
  /** Plate head above an open list or grid (title, counts, summary chips). */
  listHead: number;
  /** Page indicator and previous/next keys under a list or grid. */
  pagerH: number;
  rowH: number;
  rowGap: number;
  cellMinW: number;
  cellH: number;
  /** Head of a home plate above its cells (title and counts). */
  tileHead: number;
  homeCellH: number;
  /** Most cells a home plate shows, per kind. */
  homeCells: Record<CarrierKind, { max: number; columns: number }>;
  /** Distance a list row travels while paging in or out. */
  pageShift: number;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export function stageMetrics(viewportW: number, config: StageConfig = stageConfig): StageMetrics {
  const rail = config.railWidth;
  return {
    gap: clamp(8, viewportW * 0.007, 12), // --gap
    pad: clamp(16, viewportW * 0.015, 28), // --pad
    railW: Math.round(clamp(rail.min, viewportW * rail.vw, rail.max)),
    stripH: 64,
    listHead: 120,
    pagerH: 56,
    rowH: viewportW < 1280 ? 80 : 92,
    rowGap: 6,
    cellMinW: 200,
    cellH: 128,
    tileHead: 96,
    homeCellH: 52,
    homeCells: { event: { max: 3, columns: 1 }, artist: { max: 8, columns: 2 } },
    pageShift: 12,
  };
}

/** A kind's carriers in list order, and the list page the address asks for. */
export interface ItemList {
  order: readonly string[];
  page?: number;
}

export interface LayoutInput {
  items?: Partial<Record<CarrierKind, ItemList>>;
  /** Defaults to the stage width; the rail and fluid gaps follow the viewport like the CSS does. */
  viewportW?: number;
  metrics?: Partial<StageMetrics>;
  config?: StageConfig;
}

export interface PlacedItem {
  rect: Rect;
  mode: ItemMode;
  visible: boolean;
  /** Position among the shown items of its kind, for staggered arrival. */
  order: number;
}

export interface ListInfo {
  perPage: number;
  pages: number;
  /** The requested page, clamped to the pages there are. */
  page: number;
}

export interface StageLayout {
  plates: Record<PlateId, { mode: PlateMode; rect: Rect }>;
  /** Fixed rail slots, present whenever the rail is. A slot whose plate is elsewhere shows as open. */
  rail: Record<PlateId, Rect> | null;
  openSlots: PlateId[];
  /** The work area beside the rail (an open plate, or a strip plus a detail). */
  focus: Rect | null;
  detail: Rect | null;
  /** Keyed by carrier key (`event:TRM-02`). */
  items: Record<string, PlacedItem>;
  /** Paging of the open list, when a list is open. */
  list: (ListInfo & { kind: CarrierKind; pager: Rect }) | null;
  /** How many carriers each home plate shows as cells. */
  homeCells: Record<CarrierKind, number>;
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
const shift = (rect: Rect, dy: number): Rect => ({ ...rect, y: rect.y + dy });

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

function homeRects(stage: Size, m: StageMetrics, config: StageConfig): Record<PlateId, Rect> {
  const { columns, sideMinW } = config.home;
  const free = stage.w - m.gap * (columns.length - 1);
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const widths = columns.map(column => (free * column.width) / total);
  const last = widths.length - 1;
  if (last > 0 && widths[last] < sideMinW) {
    const side = Math.min(sideMinW, free * 0.4);
    const restWeight = total - columns[last].width;
    columns.slice(0, last).forEach((column, index) => {
      widths[index] = ((free - side) * column.width) / restWeight;
    });
    widths[last] = side;
  }
  const spans = split(0, stage.w, widths, m.gap);
  const rects = {} as Record<PlateId, Rect>;
  columns.forEach((column, index) => {
    const [x0, x1] = spans[index];
    const rows = split(0, stage.h, column.plates.map(([, weight]) => weight), m.gap);
    column.plates.forEach(([id], row) => {
      rects[id] = edges(x0, rows[row][0], x1, rows[row][1]);
    });
  });
  return rects;
}

function railRects(stage: Size, m: StageMetrics, config: StageConfig): Record<PlateId, Rect> {
  const slots = split(0, stage.h, PLATE_ORDER.map(() => 1), m.gap);
  const x0 = config.railSide === 'left' ? 0 : stage.w - m.railW;
  return Object.fromEntries(PLATE_ORDER.map((id, index) => [id, edges(x0, slots[index][0], x0 + m.railW, slots[index][1])])) as Record<PlateId, Rect>;
}

/** Rows fill the plate below its head; how many fit decides the page size (at least three). */
export function listRowsPerPage(areaH: number, m: StageMetrics): number {
  return Math.max(3, Math.floor((areaH - m.listHead - m.pagerH + m.rowGap) / (m.rowH + m.rowGap)));
}

/** Slot rects of one list page: full-width rows for events, a grid of cells for artists. */
function listSlots(kind: CarrierKind, area: Rect, m: StageMetrics): Rect[] {
  const top = area.y + m.listHead;
  if (kind === 'event') {
    return Array.from({ length: listRowsPerPage(area.h, m) }, (_, index) => {
      const y = top + index * (m.rowH + m.rowGap);
      return edges(area.x + m.pad, y, area.x + area.w - m.pad, y + m.rowH);
    });
  }
  const innerW = area.w - 2 * m.pad;
  const cols = Math.max(1, Math.floor((innerW + m.gap) / (m.cellMinW + m.gap)));
  const rows = Math.max(1, Math.floor((area.h - m.listHead - m.pagerH + m.gap) / (m.cellH + m.gap)));
  const columns = split(area.x + m.pad, innerW, Array.from({ length: cols }, () => 1), m.gap);
  return Array.from({ length: cols * rows }, (_, index) => {
    const [x0, x1] = columns[index % cols];
    const y = top + Math.floor(index / cols) * (m.cellH + m.gap);
    return edges(x0, y, x1, y + m.cellH);
  });
}

/** Cells along the bottom of a home plate, under its head, as many as fit up to the kind's max. */
function homeSlots(kind: CarrierKind, tile: Rect, m: StageMetrics): Rect[] {
  const { max, columns } = m.homeCells[kind];
  const rows = Math.max(0, Math.floor((tile.h - m.tileHead - m.pad + m.gap) / (m.homeCellH + m.gap)));
  const count = Math.min(max, rows * columns);
  const cols = split(tile.x + m.pad, tile.w - 2 * m.pad, Array.from({ length: columns }, () => 1), m.gap);
  return Array.from({ length: count }, (_, index) => {
    const [x0, x1] = cols[index % columns];
    const y = tile.y + m.tileHead + Math.floor(index / columns) * (m.homeCellH + m.gap);
    return edges(x0, y, x1, y + m.homeCellH);
  });
}

const inside = (rect: Rect, stage: Size) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= stage.w && rect.y + rect.h <= stage.h;

/**
 * Where every plate and carrier sits for a state. Pure and deterministic: it reads no DOM, so the
 * same state and stage size always give the same rects.
 */
export function computeLayout(state: StageState, stage: Size, input: LayoutInput = {}): StageLayout {
  const config = input.config ?? stageConfig;
  const m = { ...stageMetrics(input.viewportW ?? stage.w, config), ...input.metrics };
  const home = homeRects(stage, m, config);
  const parent = parentPlate(state);
  const plates = {} as StageLayout['plates'];
  const items: Record<string, PlacedItem> = {};
  let rail: StageLayout['rail'] = null;
  let focus: Rect | null = null;
  let detail: Rect | null = null;
  let list: StageLayout['list'] = null;
  const homeCells: Record<CarrierKind, number> = { event: 0, artist: 0 };

  if (state.view === 'home' || state.view === 'none' || !parent) {
    const mode: PlateMode = state.view === 'home' ? 'tile' : 'hidden';
    for (const id of PLATE_ORDER) plates[id] = { mode, rect: home[id] };
  } else {
    rail = railRects(stage, m, config);
    focus = config.railSide === 'left' ? edges(m.railW + m.gap, 0, stage.w, stage.h) : edges(0, 0, stage.w - m.railW - m.gap, stage.h);
    for (const id of PLATE_ORDER) plates[id] = { mode: 'rail', rect: rail[id] };
    if (state.view === 'plate') {
      plates[parent] = { mode: 'focus', rect: focus };
    } else if (config.detailStrip) {
      plates[parent] = { mode: 'strip', rect: edges(focus.x, 0, focus.x + focus.w, m.stripH) };
      detail = edges(focus.x, m.stripH + m.gap, focus.x + focus.w, stage.h);
    } else {
      detail = focus;
    }
  }

  for (const kind of ['event', 'artist'] as const) {
    const source = input.items?.[kind];
    if (!source) continue;
    const owner = plates[ITEM_OWNER[kind]];
    const place = (id: string, placed: Omit<PlacedItem, 'order'>, order = 0) => {
      items[carrierKey(kind, id)] = { ...placed, order };
    };

    if (owner.mode === 'focus') {
      const slots = listSlots(kind, owner.rect, m);
      const perPage = slots.length;
      const pages = Math.max(1, Math.ceil(source.order.length / perPage));
      const page = Math.min(Math.max(1, source.page ?? 1), pages);
      const pagerTop = owner.rect.y + owner.rect.h - m.pagerH;
      list = { kind, perPage, pages, page, pager: edges(owner.rect.x + m.pad, pagerTop, owner.rect.x + owner.rect.w - m.pad, owner.rect.y + owner.rect.h) };
      source.order.forEach((id, index) => {
        const onPage = Math.floor(index / perPage) + 1;
        const slot = slots[index % perPage];
        // Rows of other pages wait in their own slot, just off it on the side they will come from.
        if (onPage === page) place(id, { rect: slot, mode: 'row', visible: true }, index % perPage);
        else place(id, { rect: shift(slot, onPage < page ? -m.pageShift : m.pageShift), mode: 'folded', visible: false });
      });
    } else if (owner.mode === 'tile') {
      const slots = homeSlots(kind, owner.rect, m);
      homeCells[kind] = Math.min(slots.length, source.order.length);
      source.order.forEach((id, index) => {
        if (index < slots.length) place(id, { rect: slots[index], mode: 'cell', visible: true }, index);
        else place(id, { rect: owner.rect, mode: 'folded', visible: false });
      });
    } else {
      const openId = state.view === 'session' && kind === 'event' ? state.eventId : state.view === 'artist' && kind === 'artist' ? state.artistKey : null;
      source.order.forEach(id => {
        if (id === openId && detail) place(id, { rect: detail, mode: 'detail', visible: true });
        else place(id, { rect: owner.rect, mode: 'folded', visible: false });
      });
    }
  }

  const openSlots = rail ? PLATE_ORDER.filter(id => plates[id].mode !== 'rail') : [];
  const shown = [
    ...PLATE_ORDER.filter(id => plates[id].mode !== 'hidden').map(id => plates[id].rect),
    ...Object.values(items).filter(item => item.visible).map(item => item.rect),
    ...(list ? [list.pager] : []),
  ];
  const fits = shown.every(rect => inside(rect, stage) && rect.w > 0 && rect.h > 0)
    && (!list || Object.values(items).every(item => item.mode !== 'row' || item.rect.y + item.rect.h <= list!.pager.y));

  return { plates, rail, openSlots, focus, detail, items, list, homeCells, fits };
}

/** Page sizes in flow mode, where lists are not cut to a height: the long-standing 4 and 12. */
export const FLOW_PAGE_SIZE: Record<CarrierKind, number> = { event: 4, artist: 12 };
const NO_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The same states for flow (document scroll) mode: which plate is open and which carriers show,
 * without geometry. Home plates carry their own cells there, so no carrier shows as a cell.
 */
export function computeFlowLayout(state: StageState, input: Pick<LayoutInput, 'items' | 'config'> = {}): StageLayout {
  const config = input.config ?? stageConfig;
  const parent = parentPlate(state);
  const plates = {} as StageLayout['plates'];
  const items: Record<string, PlacedItem> = {};
  let list: StageLayout['list'] = null;
  const rail = state.view !== 'home' && state.view !== 'none' && parent !== null;
  for (const id of PLATE_ORDER) plates[id] = { mode: state.view === 'home' ? 'tile' : rail ? 'rail' : 'hidden', rect: NO_RECT };
  if (rail && parent) plates[parent] = { mode: state.view === 'plate' ? 'focus' : config.detailStrip ? 'strip' : 'rail', rect: NO_RECT };

  for (const kind of ['event', 'artist'] as const) {
    const source = input.items?.[kind];
    if (!source) continue;
    const folded = (id: string) => (items[carrierKey(kind, id)] = { rect: NO_RECT, mode: 'folded', visible: false, order: 0 });
    if (plates[ITEM_OWNER[kind]].mode === 'focus') {
      const perPage = FLOW_PAGE_SIZE[kind];
      const pages = Math.max(1, Math.ceil(source.order.length / perPage));
      const page = Math.min(Math.max(1, source.page ?? 1), pages);
      list = { kind, perPage, pages, page, pager: NO_RECT };
      source.order.forEach((id, index) => {
        if (Math.floor(index / perPage) + 1 === page) items[carrierKey(kind, id)] = { rect: NO_RECT, mode: 'row', visible: true, order: index % perPage };
        else folded(id);
      });
    } else {
      const openId = state.view === 'session' && kind === 'event' ? state.eventId : state.view === 'artist' && kind === 'artist' ? state.artistKey : null;
      source.order.forEach(id => {
        if (id === openId) items[carrierKey(kind, id)] = { rect: NO_RECT, mode: 'detail', visible: true, order: 0 };
        else folded(id);
      });
    }
  }
  const openSlots = rail ? PLATE_ORDER.filter(id => plates[id].mode !== 'rail') : [];
  return { plates, rail: null, openSlots, focus: null, detail: null, items, list, homeCells: { event: 0, artist: 0 }, fits: true };
}
