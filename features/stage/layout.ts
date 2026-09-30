import { stageConfig, type Density, type LayoutLeaf, type LayoutNode, type StageConfig, type ViewName } from './config';
import { PLATE_ORDER, carrierKey, type CarrierKind, type PlateId, type StageState } from './state';

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type PlateMode = Density | 'hidden';
/**
 * A carrier is a sub-plate of its owner plate: a cell of a summary, a row (or card) of the open list,
 * a line of an index, or folded away. The open detail is a plate of its own that grows out of it.
 */
export type ItemMode = 'cell' | 'row' | 'index' | 'folded';

/** The plate each kind of carrier belongs to. */
export const ITEM_OWNER: Record<CarrierKind, PlateId> = { event: 'events', artist: 'artists' };

/** The view a state shows, or null off the stage. */
export function viewName(state: StageState): ViewName | null {
  switch (state.view) {
    case 'home':
      return 'home';
    case 'session':
      return 'session';
    case 'artist':
      return 'artist';
    case 'plate':
      return state.plate === 'next' ? 'home' : state.plate;
    default:
      return null;
  }
}

/** Sizes in px. The fluid ones follow the same clamps as the CSS tokens of the same role. */
export interface StageMetrics {
  gap: number;
  pad: number;
  /** Default head heights by density, used until the real heads have been measured. */
  head: Record<'hero' | 'panel' | 'index', number>;
  pagerH: number;
  rowH: number;
  /** A row narrower than `narrowRowW` lays out on three lines and needs this height instead. */
  rowHNarrow: number;
  narrowRowW: number;
  rowGap: number;
  cellMinW: number;
  cellH: number;
  panelCellH: number;
  indexRowH: number;
  /** Most cells a summary plate shows, and in how many columns, per kind. */
  panelCells: Record<CarrierKind, { max: number; columns: number }>;
  /** Distance a list row travels while paging in or out. */
  pageShift: number;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export function stageMetrics(viewportW: number): StageMetrics {
  return {
    gap: clamp(8, viewportW * 0.007, 12), // --gap
    pad: clamp(16, viewportW * 0.015, 28), // --pad
    head: { hero: 120, panel: 96, index: 72 },
    pagerH: 56,
    rowH: viewportW < 1280 ? 84 : 92,
    rowHNarrow: 124,
    narrowRowW: 760,
    // Sub-plates sit flush against each other and the plate's edges; plates keep their gap.
    rowGap: 0,
    cellMinW: 200,
    cellH: 128,
    panelCellH: 52,
    indexRowH: 44,
    panelCells: { event: { max: 4, columns: 1 }, artist: { max: 10, columns: 2 } },
    pageShift: 12,
  };
}

/** A kind's carriers in list order, and the list page the address asks for. */
export interface ItemList {
  order: readonly string[];
  page?: number;
}

/**
 * How the current view escaped content that did not fit, grown step by step from measurements:
 * the open plate first gets the first sheet to itself (`alone`), other plates that spill move to a
 * sheet of their own (`moved`), and a plate alone on a sheet that still spills makes that sheet
 * taller (`grow`, extra px). Keyed by leaf: a plate id, or `detail`.
 */
export interface Spill {
  alone: boolean;
  moved: PlateId[];
  grow: Partial<Record<PlateId | 'detail', number>>;
}
export const NO_SPILL: Spill = { alone: false, moved: [], grow: {} };

export interface LayoutInput {
  items?: Partial<Record<CarrierKind, ItemList>>;
  spill?: Spill;
  /** Space between sheets (the frame padding above and below each), px. */
  sheetGap?: number;
  /** Measured head heights (px from the plate's top to where its carriers may start). */
  heads?: Partial<Record<PlateId, number>>;
  /** Defaults to the stage width; fluid gaps follow the viewport like the CSS does. */
  viewportW?: number;
  metrics?: Partial<StageMetrics>;
  config?: StageConfig;
}

export interface PlacedItem {
  /** On the stage. */
  rect: Rect;
  /** Inside its owner plate: sub-plates ride with the plate and only re-tile within it. */
  rel: Rect;
  mode: ItemMode;
  visible: boolean;
  /** Position among the shown items of its kind, for staggered arrival. */
  order: number;
  /** The line of the detail that is open (an index keeps it, marked current). */
  current?: boolean;
}

export interface ListInfo {
  perPage: number;
  pages: number;
  /** The requested page, clamped to the pages there are. */
  page: number;
}

export interface StageLayout {
  view: ViewName | null;
  /** Screens the view spans, top to bottom; the page snaps from one to the next. */
  sheets: { y: number; h: number }[];
  /** Which sheet each leaf landed on (plate id, `detail` or `back`). */
  sheetOf: Partial<Record<PlateId | 'detail' | 'back', number>>;
  plates: Record<PlateId, { mode: PlateMode; rect: Rect }>;
  detail: Rect | null;
  /** The card back to the previous view; null on the home. */
  back: Rect | null;
  /** Keyed by carrier key (`event:TRM-02`). */
  items: Record<string, PlacedItem>;
  /** Paging of the open list, when a list is open. */
  list: (ListInfo & { kind: CarrierKind; pager: Rect }) | null;
  /** The detail that is open, if any, and which carrier it belongs to. */
  open: { kind: CarrierKind; id: string } | null;
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

const isLeaf = (node: LayoutNode | LayoutLeaf): node is LayoutLeaf => !('dir' in node);

/** Solves a tiling into leaf rects. */
export function tile(node: LayoutNode, area: Rect, gap: number, out: [LayoutLeaf, Rect][] = []): [LayoutLeaf, Rect][] {
  const along = node.dir === 'row' ? area.w : area.h;
  const spans = split(node.dir === 'row' ? area.x : area.y, along, node.parts.map(([weight]) => weight), gap);
  node.parts.forEach(([, child], index) => {
    const [a, b] = spans[index];
    const rect = node.dir === 'row' ? edges(a, area.y, b, area.y + area.h) : edges(area.x, a, area.x + area.w, b);
    if (isLeaf(child)) out.push([child, rect]);
    else tile(child, rect, gap, out);
  });
  return out;
}

/** A list row's height: taller in a plate narrow enough for the row to stack its lines. */
export const rowHeight = (areaW: number, m: StageMetrics) => (areaW < m.narrowRowW ? m.rowHNarrow : m.rowH);

/** Rows fill the plate below its head; how many fit decides the page size (at least one). */
export function listRowsPerPage(areaH: number, head: number, m: StageMetrics, areaW = Infinity): number {
  return Math.max(1, Math.floor((areaH - head - m.pagerH + m.rowGap) / (rowHeight(areaW, m) + m.rowGap)));
}

/** Slot rects of one list page, flush from edge to edge: rows for events, a grid of cards for artists. */
function listSlots(kind: CarrierKind, area: Rect, head: number, m: StageMetrics): Rect[] {
  const top = area.y + head;
  if (kind === 'event') {
    const rowH = rowHeight(area.w, m);
    return Array.from({ length: listRowsPerPage(area.h, head, m, area.w) }, (_, index) => {
      const y = top + index * (rowH + m.rowGap);
      return edges(area.x, y, area.x + area.w, y + rowH);
    });
  }
  const cols = Math.max(1, Math.floor(area.w / m.cellMinW));
  const rows = Math.max(1, Math.floor((area.h - head - m.pagerH) / m.cellH));
  const columns = split(area.x, area.w, Array.from({ length: cols }, () => 1), 0);
  return Array.from({ length: cols * rows }, (_, index) => {
    const [x0, x1] = columns[index % cols];
    const y = top + Math.floor(index / cols) * m.cellH;
    return edges(x0, y, x1, y + m.cellH);
  });
}

/** Cells under a summary plate's head, flush, as many as fit up to the kind's max. */
function panelSlots(kind: CarrierKind, plate: Rect, head: number, m: StageMetrics): Rect[] {
  const { max, columns } = m.panelCells[kind];
  const rows = Math.max(0, Math.floor((plate.h - head) / m.panelCellH));
  const count = Math.min(max, rows * columns);
  const cols = split(plate.x, plate.w, Array.from({ length: columns }, () => 1), 0);
  return Array.from({ length: count }, (_, index) => {
    const [x0, x1] = cols[index % columns];
    const y = plate.y + head + Math.floor(index / columns) * m.panelCellH;
    return edges(x0, y, x1, y + m.panelCellH);
  });
}

/** Lines of an index under its head, flush. */
function indexSlots(plate: Rect, head: number, m: StageMetrics): Rect[] {
  const count = Math.max(0, Math.floor((plate.h - head) / m.indexRowH));
  return Array.from({ length: count }, (_, index) => {
    const y = plate.y + head + index * m.indexRowH;
    return edges(plate.x, y, plate.x + plate.w, y + m.indexRowH);
  });
}

type LeafKey = PlateId | 'detail' | 'back';
const leafKey = (leaf: LayoutLeaf): LeafKey => ('plate' in leaf ? leaf.plate : leaf.slot);

/** The tree without the leaves `drop` names; empty splits disappear. */
function prune(node: LayoutNode, drop: (key: LeafKey) => boolean): LayoutNode | null {
  const parts = node.parts
    .map(([weight, child]) => [weight, isLeaf(child) ? (drop(leafKey(child)) ? null : child) : prune(child, drop)] as const)
    .filter((part): part is readonly [number, LayoutNode | LayoutLeaf] => part[1] !== null)
    .map(([weight, child]) => [weight, child] as [number, LayoutNode | LayoutLeaf]);
  return parts.length ? { dir: node.dir, parts } : null;
}
const leavesOf = (node: LayoutNode): LayoutLeaf[] => node.parts.flatMap(([, child]) => (isLeaf(child) ? [child] : leavesOf(child)));
/** The same leaves stacked top to bottom, for narrow screens. */
const stacked = (node: LayoutNode): LayoutNode => ({ dir: 'col', parts: leavesOf(node).map(leaf => [1, leaf] as [number, LayoutLeaf]) });
const wrap = (node: LayoutNode | LayoutLeaf): LayoutNode => (isLeaf(node) ? { dir: 'col', parts: [[1, node]] } : node);
/** The view's main leaf: the open detail, else the hero plate. */
function primaryOf(tree: LayoutNode): LeafKey | null {
  const leaves = leavesOf(tree);
  const detail = leaves.find(leaf => 'slot' in leaf && leaf.slot === 'detail');
  if (detail) return 'detail';
  const hero = leaves.find(leaf => 'plate' in leaf && leaf.density === 'hero');
  return hero && 'plate' in hero ? hero.plate : null;
}

/** Below this stage width the tiling does not fit side by side; its columns become sheets. */
export const NARROW_W = 900;

/**
 * The sheets a view spans. The first sheet holds the view's tiling; on a narrow stage the
 * tiling's columns each become a sheet, the main one first. Spilled plates follow on sheets of
 * their own.
 */
function sheetTrees(tree: LayoutNode, stage: Size, spill: Spill): LayoutNode[] {
  const primary = primaryOf(tree);
  const moved = new Set<LeafKey>(spill.moved.filter(id => id !== primary));
  const own = [...moved].map(key => wrap(leavesOf(tree).find(leaf => leafKey(leaf) === key)!)).filter(Boolean);
  const rest = prune(tree, key => moved.has(key));
  if (!rest) return own;
  const hasBack = leavesOf(rest).some(leaf => leafKey(leaf) === 'back');
  const primaryLeaf = leavesOf(rest).find(leaf => leafKey(leaf) === primary);
  const alone = (node: LayoutLeaf): LayoutNode => (hasBack ? { dir: 'col', parts: [[10, { slot: 'back' }], [90, node]] } : wrap(node));
  if (stage.w < NARROW_W) {
    // Each top-level part becomes a sheet (stacked), the one with the main leaf first.
    const others = prune(rest, key => key === primary || key === 'back');
    const parts = others && others.dir === 'row' ? others.parts.map(([, child]) => (isLeaf(child) ? wrap(child) : stacked(child))) : others ? [stacked(others)] : [];
    return [...(primaryLeaf ? [alone(primaryLeaf)] : []), ...parts, ...own];
  }
  if (spill.alone && primaryLeaf) {
    const others = prune(rest, key => key === primary || key === 'back');
    return [alone(primaryLeaf), ...(others ? [others] : []), ...own];
  }
  return [rest, ...own];
}

const inside = (rect: Rect, w: number) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= w;

/**
 * Where every plate and carrier sits for a state. Pure and deterministic: it reads no DOM (head
 * heights and spills come in measured), so the same inputs always give the same rects.
 */
export function computeLayout(state: StageState, stage: Size, input: LayoutInput = {}): StageLayout {
  const config = input.config ?? stageConfig;
  const m = { ...stageMetrics(input.viewportW ?? stage.w), ...input.metrics };
  const spill = input.spill ?? NO_SPILL;
  const sheetGap = input.sheetGap ?? 20;
  const view = viewName(state);
  const plates = {} as StageLayout['plates'];
  const sheets: StageLayout['sheets'] = [];
  const sheetOf: StageLayout['sheetOf'] = {};
  let detail: Rect | null = null;
  let back: Rect | null = null;
  let y = 0;
  sheetTrees(config.layouts[view ?? 'home'], stage, spill).forEach((tree, index) => {
    // A sheet with a single leaf grows by what that leaf still needs.
    const only = leavesOf(tree).filter(leaf => leafKey(leaf) !== 'back');
    const grow = only.length === 1 ? spill.grow[leafKey(only[0]) as PlateId | 'detail'] ?? 0 : 0;
    const h = stage.h + grow;
    sheets.push({ y, h });
    for (const [leaf, rect] of tile(tree, { x: 0, y, w: stage.w, h }, m.gap)) {
      sheetOf[leafKey(leaf)] = index;
      if ('plate' in leaf) plates[leaf.plate] = { mode: view ? leaf.density : 'hidden', rect };
      else if (leaf.slot === 'detail') detail = rect;
      else back = rect;
    }
    y += h + sheetGap;
  });
  // A plate a tiling forgot still exists; it waits folded where it would be on the home.
  const homeLeaves = tile(config.layouts.home, { x: 0, y: 0, w: stage.w, h: stage.h }, m.gap);
  for (const id of PLATE_ORDER) {
    if (plates[id]) continue;
    const fallback = homeLeaves.find(([leaf]) => 'plate' in leaf && leaf.plate === id)?.[1] ?? { x: 0, y: 0, w: 0, h: 0 };
    plates[id] = { mode: 'hidden', rect: fallback };
  }

  const items: Record<string, PlacedItem> = {};
  let list: StageLayout['list'] = null;
  const openId = (kind: CarrierKind) =>
    state.view === 'session' && kind === 'event' ? state.eventId : state.view === 'artist' && kind === 'artist' ? state.artistKey : null;

  for (const kind of ['event', 'artist'] as const) {
    const source = input.items?.[kind];
    if (!source) continue;
    const ownerId = ITEM_OWNER[kind];
    const owner = plates[ownerId];
    const open = openId(kind);
    const place = (id: string, placed: Omit<PlacedItem, 'order' | 'rel'>, order = 0) => {
      const { rect } = placed;
      items[carrierKey(kind, id)] = { ...placed, order, rel: { x: rect.x - owner.rect.x, y: rect.y - owner.rect.y, w: rect.w, h: rect.h } };
    };
    const folded = (id: string) => place(id, { rect: owner.rect, mode: 'folded', visible: false });

    if (owner.mode === 'hero') {
      const head = input.heads?.[ownerId] ?? m.head.hero;
      const slots = listSlots(kind, owner.rect, head, m);
      const perPage = slots.length;
      const pages = Math.max(1, Math.ceil(source.order.length / perPage));
      const page = Math.min(Math.max(1, source.page ?? 1), pages);
      const pagerTop = owner.rect.y + owner.rect.h - m.pagerH;
      list = { kind, perPage, pages, page, pager: edges(owner.rect.x, pagerTop, owner.rect.x + owner.rect.w, owner.rect.y + owner.rect.h) };
      source.order.forEach((id, index) => {
        const onPage = Math.floor(index / perPage) + 1;
        const slot = slots[index % perPage];
        // Rows of other pages wait in their own slot, just off it on the side they will come from.
        if (onPage === page) place(id, { rect: slot, mode: 'row', visible: true }, index % perPage);
        else place(id, { rect: shift(slot, onPage < page ? -m.pageShift : m.pageShift), mode: 'folded', visible: false });
      });
    } else if (owner.mode === 'panel') {
      const head = input.heads?.[ownerId] ?? m.head.panel;
      const slots = panelSlots(kind, owner.rect, head, m);
      source.order.forEach((id, index) => {
        if (index < slots.length) place(id, { rect: slots[index], mode: 'cell', visible: true }, index);
        else folded(id);
      });
    } else if (owner.mode === 'index') {
      const head = input.heads?.[ownerId] ?? m.head.index;
      const slots = indexSlots(owner.rect, head, m);
      // A window of the list that keeps the open line in view.
      const at = open ? source.order.indexOf(open) : 0;
      const start = Math.max(0, Math.min(at - Math.floor(slots.length / 2), source.order.length - slots.length));
      source.order.forEach((id, index) => {
        const slot = slots[index - start];
        if (slot) place(id, { rect: slot, mode: 'index', visible: true, current: id === open }, index - start);
        else folded(id);
      });
    } else {
      source.order.forEach(folded);
    }
  }

  const shown = [
    ...PLATE_ORDER.filter(id => plates[id].mode !== 'hidden').map(id => plates[id].rect),
    ...Object.values(items).filter(item => item.visible).map(item => item.rect),
    ...(list ? [list.pager] : []),
  ];
  const fits = shown.every(rect => inside(rect, stage.w) && rect.w > 0 && rect.h > 0)
    && (!list || Object.values(items).every(item => item.mode !== 'row' || item.rect.y + item.rect.h <= list!.pager.y));

  const openKind: CarrierKind | null = state.view === 'session' ? 'event' : state.view === 'artist' ? 'artist' : null;
  const open = openKind && detail ? { kind: openKind, id: openId(openKind)! } : null;
  return { view, sheets, sheetOf, plates, detail, back: view && view !== 'home' ? back : null, items, list, open, fits };
}

/** Page sizes in flow mode, where lists are not cut to a height: the long-standing 4 and 12. */
const FLOW_PAGE_SIZE: Record<CarrierKind, number> = { event: 4, artist: 12 };
const NO_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The same states for flow (document scroll) mode, without geometry. The open plate is a hero, the
 * home keeps its densities, every other plate is a chip; summary plates draw their own cells there.
 */
export function computeFlowLayout(state: StageState, input: Pick<LayoutInput, 'items' | 'config'> = {}): StageLayout {
  const config = input.config ?? stageConfig;
  const view = viewName(state);
  const plates = {} as StageLayout['plates'];
  const home = tile(config.layouts.home, { x: 0, y: 0, w: 1000, h: 1000 }, 0);
  for (const id of PLATE_ORDER) {
    const homeDensity = home.find(([leaf]) => 'plate' in leaf && leaf.plate === id)?.[0] as { density: Density } | undefined;
    const hero = view !== 'home' && view !== 'session' && view !== 'artist' && view === (id === 'log' ? 'log' : id);
    plates[id] = { mode: !view ? 'hidden' : view === 'home' ? homeDensity?.density ?? 'tile' : hero ? 'hero' : 'chip', rect: NO_RECT };
  }
  const items: Record<string, PlacedItem> = {};
  let list: StageLayout['list'] = null;
  for (const kind of ['event', 'artist'] as const) {
    const source = input.items?.[kind];
    if (!source) continue;
    const owner = plates[ITEM_OWNER[kind]];
    const open = state.view === 'session' && kind === 'event' ? state.eventId : state.view === 'artist' && kind === 'artist' ? state.artistKey : null;
    const folded = (id: string) => (items[carrierKey(kind, id)] = { rect: NO_RECT, rel: NO_RECT, mode: 'folded', visible: false, order: 0 });
    if (owner.mode === 'hero') {
      const perPage = FLOW_PAGE_SIZE[kind];
      const pages = Math.max(1, Math.ceil(source.order.length / perPage));
      const page = Math.min(Math.max(1, source.page ?? 1), pages);
      list = { kind, perPage, pages, page, pager: NO_RECT };
      source.order.forEach((id, index) => {
        if (Math.floor(index / perPage) + 1 === page) items[carrierKey(kind, id)] = { rect: NO_RECT, rel: NO_RECT, mode: 'row', visible: true, order: index % perPage };
        else folded(id);
      });
    } else {
      source.order.forEach(folded);
    }
  }
  const openKind: CarrierKind | null = state.view === 'session' ? 'event' : state.view === 'artist' ? 'artist' : null;
  const openFlow = openKind ? { kind: openKind, id: state.view === 'session' ? state.eventId : state.view === 'artist' ? state.artistKey : '' } : null;
  return { view, sheets: [], sheetOf: {}, plates, detail: null, back: view && view !== 'home' ? NO_RECT : null, items, list, open: openFlow, fits: true };
}
