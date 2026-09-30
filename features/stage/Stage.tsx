'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Surface } from '@/features/ui/Ui';
import { stageConfig } from './config';
import { stageSizeFor, useStageData, useViewport } from './data';
import { Box } from './Box';
import { NO_SPILL, computeFlowLayout, computeLayout, stageMetrics, type PlacedItem, type PlateMode, type Rect, type Spill, type StageLayout } from './layout';
import {
  PLATE_ORDER,
  carrierKey,
  parseCarrierMark,
  resolveMissing,
  stageOrigin,
  stageParentHref,
  stageStateFromUrl,
  stateHref,
  stateKey,
  type CarrierKind,
  type PlateId,
  type StageState,
} from './state';
import { StageModeContext, pageAnnouncement, pageKey, pageReadout, useWheelPaging, type StageRenderMode } from './usePaging';
import { PlateContent, plateSurface } from './plates/Plates';
import { BackCard } from './plates/BackCard';
import { EventItem, eventSurface, type ItemShape } from './plates/EventItem';
import { ArtistItem, artistSurface } from './plates/ArtistItem';
import styles from './stage.module.css';

/** Plates that shrink leave one after another, this far apart (ms). */
const SHRINK_STAGGER = 30;
/** How long a folded detail keeps its full content before it rests as a light row (ms). */
const DETAIL_REST_MS = 700;
/** Plates whose heads the carriers sit under; their real head heights feed the layout. */
const HEADED: PlateId[] = ['events', 'artists'];
const SIZE_RANK: Record<PlateMode, number> = { hidden: 0, chip: 1, index: 2, tile: 3, panel: 4, hero: 5 };

type SpillState = { key: string; w: number; h: number; spill: Spill };
type Origin = { item: string; token: number; rect: Rect };
type Heads = Partial<Record<PlateId, { mode: PlateMode; px: number }>>;

const listHref = (kind: CarrierKind, page: number) => `${kind === 'event' ? '/events' : '/artists'}${page > 1 ? `?page=${page}` : ''}`;

function typing(target: EventTarget | null) {
  return !!(target as Element | null)?.closest?.('input, textarea, select, [contenteditable=true]');
}

/** The first title of the current view that is not on its way out. */
function viewTitle(root: HTMLElement): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-stage-title]')].find(node => !node.closest('[inert]')) ?? null;
}

/**
 * The first plate or detail whose shown content spills out of the rect it was given, with how many
 * px it is short. Carriers in lists and cells have fixed shapes and are not counted.
 */
function spillOf(root: HTMLElement): { leaf: PlateId | 'detail'; short: number; node: HTMLElement } | null {
  for (const node of root.querySelectorAll<HTMLElement>('[data-fit]')) {
    if (node.closest('[inert]')) continue;
    const short = node.scrollHeight - node.clientHeight;
    if (short <= 1) continue;
    const plate = node.closest<HTMLElement>('[data-plate]')?.dataset.plate as PlateId | undefined;
    const detail = node.closest<HTMLElement>('[data-item][data-mode=detail]');
    if (plate) return { leaf: plate, short, node };
    if (detail) return { leaf: 'detail', short, node };
  }
  return null;
}

/** The next step for a leaf that spills: the open leaf first gets a sheet to itself, others move to their own sheet, then a sheet grows. */
function escalate(spill: Spill, leaf: PlateId | 'detail', short: number, primary: PlateId | 'detail' | null): Spill {
  const grow = (px: number) => ({ ...spill, grow: { ...spill.grow, [leaf]: (spill.grow[leaf] ?? 0) + px } });
  if (leaf === primary) return spill.alone ? grow(short + 8) : { ...spill, alone: true };
  if (leaf !== 'detail' && !spill.moved.includes(leaf)) return { ...spill, moved: [...spill.moved, leaf] };
  return grow(short + 8);
}

/** Heights from each headed plate's top to the end of its head (its carriers start below). */
function measureHeads(root: HTMLElement, plates: StageLayout['plates'], gap: number): Heads {
  const heads: Heads = {};
  for (const id of HEADED) {
    const layer = root.querySelector<HTMLElement>(`[data-plate="${id}"] > [data-layer=current]`);
    const head = layer?.querySelector<HTMLElement>('[data-head]');
    if (!layer || !head) continue;
    let top = 0;
    for (let node: HTMLElement | null = head; node && node !== layer; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
    heads[id] = { mode: plates[id].mode, px: Math.ceil(top + head.offsetHeight + gap) };
  }
  return heads;
}
const sameHeads = (a: Heads, b: Heads) => HEADED.every(id => a[id]?.mode === b[id]?.mode && Math.abs((a[id]?.px ?? 0) - (b[id]?.px ?? 0)) < 1);

/**
 * The stage: six plates, a back card, and one element per event and artist, all living here for
 * the whole visit. The address decides the state, the state picks the view's tiling, and every
 * element travels to its new rect with its content redrawn for the size it gets. When the window
 * is too small, or content would not fit, it becomes an ordinary scrolling page (flow mode) with
 * the same elements in document order.
 */
export function Stage({ state: address }: { state: StageState }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const { data, query } = useStageData();
  const state = resolveMissing(address, data);
  const key = stateKey(state);
  const viewport = useViewport();

  // ── Where the back card leads: the view before this one, or one level up ─────────────────
  const [trail, setTrail] = useState<StageState[]>([state]);
  if (stateKey(trail[trail.length - 1]) !== key) {
    const earlier = trail[trail.length - 2];
    setTrail(earlier && stateKey(earlier) === key ? trail.slice(0, -1) : [...trail.slice(-8), state]);
  }
  const current = stateKey(trail[trail.length - 1]) === key ? trail : [...trail, state];
  const parent = stageParentHref(state);
  const previous = current.length > 1 ? current[current.length - 2] : parent ? stageStateFromUrl(parent) : null;
  const backHref = previous && state.view !== 'home' && state.view !== 'none' ? stateHref(previous) : null;

  // ── Layout: the view's tiling, spread over as many sheets as its content needs ─────────
  const [spilled, setSpilled] = useState<SpillState | null>(null);
  const [heads, setHeads] = useState<Heads>({});
  const items = {
    event: { order: data.ordered.map(event => event.id), page: state.view === 'plate' && state.plate === 'events' ? state.page : 1 },
    artist: { order: data.profiles.map(profile => profile.key), page: state.view === 'plate' && state.plate === 'artists' ? state.page : 1 },
  };
  // The stage is first shown with the web fonts in place, so nothing is laid out, measured or paged
  // against fallback faces and then shifts.
  const [fontsReady, setFontsReady] = useState(false);
  useLayoutEffect(() => {
    const fonts = document.fonts;
    if (!fonts || fonts.status === 'loaded') return setFontsReady(true);
    let live = true;
    fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);
  const size = viewport ? stageSizeFor(viewport) : null;
  // While the window is being dragged the last spill holds; once it settles, the view starts over
  // from no spill and escalates again for the new size.
  const spill = spilled && spilled.key === key && viewport && (viewport.resizing || (spilled.w === viewport.w && spilled.h === viewport.h)) ? spilled.spill : NO_SPILL;
  const sheetGap = 2 * stageConfig.frameY;
  let staged: StageLayout | null = null;
  if (viewport && size && fontsReady && state.view !== 'none') {
    staged = computeLayout(state, size, { viewportW: viewport.w, items, spill, sheetGap });
    // Measured heads apply to the density they were measured in.
    const draft = staged;
    const known = Object.fromEntries(HEADED.filter(id => heads[id]?.mode === draft.plates[id].mode).map(id => [id, heads[id]!.px]));
    if (Object.keys(known).length) staged = computeLayout(state, size, { viewportW: viewport.w, items, heads: known, spill, sheetGap });
  }
  const mode: StageRenderMode = viewport && fontsReady ? 'stage' : 'boot';
  const layout: StageLayout = staged ?? computeFlowLayout(state, { items });
  const onStage = !!staged;
  const gap = viewport ? stageMetrics(viewport.w).gap : 0;
  const primary: PlateId | 'detail' | null = layout.detail ? 'detail' : PLATE_ORDER.find(id => layout.plates[id].mode === 'hero') ?? null;
  const sheetCount = layout.sheets.length;

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (mode === 'boot') return;
    html.dataset.stageMode = mode;
    return () => {
      delete html.dataset.stageMode;
    };
  }, [mode]);
  // More than one sheet: the page snaps sheet by sheet (html scroll-snap), like turning pages.
  useLayoutEffect(() => {
    document.documentElement.dataset.sheets = String(sheetCount);
    return () => {
      delete document.documentElement.dataset.sheets;
    };
  }, [sheetCount]);
  // A new view starts at its first sheet.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);

  // Heads are measured at the arrival size right after each change, before the frame paints.
  useLayoutEffect(() => {
    const element = root.current;
    if (!onStage || !element) return;
    const measured = measureHeads(element, layout.plates, gap);
    if (!sameHeads(measured, heads)) setHeads(measured);
  }, [onStage, layout.plates, gap, heads]);

  // Transitions start only once the first stage layout has painted, so nothing flies in from 0,0.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (!onStage) {
      if (ready) setReady(false);
      return;
    }
    if (ready) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [onStage, ready]);

  // Content that spills out of its rect is never clipped: the view escalates (see `escalate`) until
  // it fits. Checked after every change inside the stage and when the fonts arrive, heads first.
  const latest = useRef({ plates: layout.plates, spill, primary });
  // A layout effect, so a synchronous re-render inside the check loop is seen by the next step.
  useLayoutEffect(() => {
    latest.current = { plates: layout.plates, spill, primary };
  });
  useEffect(() => {
    const element = root.current;
    if (!onStage || !element || !viewport) return;
    let frame = 0;
    // Every step (heads, then one escalation) re-renders synchronously and is checked again inside
    // the same frame, so the settled layout is the first one painted. Bounded, so it cannot loop.
    const check = () => {
      frame = 0;
      if (viewport.resizing) return;
      for (let step = 0; step < 24; step += 1) {
        const measured = measureHeads(element, latest.current.plates, gap);
        let moved = false;
        flushSync(() => setHeads(previous => (sameHeads(measured, previous) ? previous : ((moved = true), measured))));
        if (moved) continue;
        const found = spillOf(element);
        if (!found) return;
        const next = escalate(latest.current.spill, found.leaf, found.short, latest.current.primary);
        flushSync(() => setSpilled({ key, w: viewport.w, h: viewport.h, spill: next }));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    const mutations = new MutationObserver(schedule);
    mutations.observe(element, { childList: true, subtree: true, characterData: true });
    let live = true;
    document.fonts?.ready.then(() => live && schedule());
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      mutations.disconnect();
    };
  }, [onStage, key, viewport, gap]);

  // ── Carrier origin: a detail opened from elsewhere sets out from where the click was ─────────
  const [origin, setOrigin] = useState<Origin | null>(null);
  const settledKey = useRef(key);
  useLayoutEffect(() => {
    if (settledKey.current === key) return;
    settledKey.current = key;
    const carrier = stageOrigin.take(state);
    if (carrier?.rect) setOrigin({ item: carrierKey(carrier.kind, carrier.id), token: performance.now(), rect: carrier.rect });
    // Focus follows the view: its title, or the stage when the title is not there yet.
    const element = root.current;
    if (element) (viewTitle(element) ?? element).focus({ preventScroll: true });
    // Only a change of view does this; `state` is described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const recordOrigin = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLElement>('a[data-carrier]');
    const mark = parseCarrierMark(link?.dataset.carrier);
    const element = root.current;
    if (!link || !mark || !element) return;
    const itemKey = carrierKey(mark.kind, mark.id);
    const own = [...element.querySelectorAll<HTMLElement>('[data-item]')].some(box => box.dataset.item === itemKey && box.contains(link));
    if (own || !onStage) return stageOrigin.record({ ...mark, rect: null });
    const from = (link.closest<HTMLElement>('[data-origin]') ?? link).getBoundingClientRect();
    const stage = element.getBoundingClientRect();
    stageOrigin.record({ ...mark, rect: { x: from.left - stage.left, y: from.top - stage.top, w: from.width, h: from.height } });
  };

  // ── Keys and wheel ──────────────────────────────────────────────────────────────────────
  const list = layout.list;
  const listTurns = {
    prev: list && list.page > 1 ? () => router.replace(listHref(list.kind, list.page - 1), { scroll: false }) : undefined,
    next: list && list.page < list.pages ? () => router.replace(listHref(list.kind, list.page + 1), { scroll: false }) : undefined,
  };
  useWheelPaging(root, listTurns, onStage && !!list, target => !!target.closest('[data-mode=hero][data-plate], [data-mode=row], [data-pager]'));

  const keysState = useRef({ list, backHref });
  useEffect(() => {
    keysState.current = { list, backHref };
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      const now = keysState.current;
      // Escape does what the back card does.
      if (event.key === 'Escape') {
        if (!now.backHref) return;
        event.preventDefault();
        router.push(now.backHref, { scroll: false });
        return;
      }
      const direction = pageKey(event);
      const inside = (event.target as Element | null)?.closest?.('[data-pages]');
      if (!direction || inside || !now.list || !root.current?.contains(document.activeElement)) return;
      const page = now.list.page + (direction === 'next' ? 1 : -1);
      if (page < 1 || page > now.list.pages) return;
      event.preventDefault();
      router.push(listHref(now.list.kind, page), { scroll: false });
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [router]);

  // Plates that get smaller move a beat after the ones that grow, one after another.
  const plateModes = Object.fromEntries(PLATE_ORDER.map(id => [id, layout.plates[id].mode])) as Record<PlateId, PlateMode>;
  const [shapes, setShapes] = useState<{ now: Record<PlateId, PlateMode>; before: Record<PlateId, PlateMode> }>({ now: plateModes, before: plateModes });
  if (PLATE_ORDER.some(id => shapes.now[id] !== plateModes[id])) setShapes({ now: plateModes, before: shapes.now });
  const shrinking = PLATE_ORDER.filter(id => SIZE_RANK[plateModes[id]] < SIZE_RANK[shapes.before[id]]);

  // ── Render ──────────────────────────────────────────────────────────────────────────────
  const last = layout.sheets[sheetCount - 1];
  const vars = (size && onStage ? { '--stage-w': `${size.w}px`, '--stage-h': `${last ? last.y + last.h : size.h}px` } : {}) as CSSProperties;
  const rect = (value: Rect) => (onStage ? value : null);

  return (
    <StageModeContext.Provider value={mode}>
      <div
        ref={root}
        id="stage"
        tabIndex={-1}
        className={styles.stage}
        data-stage={mode}
        data-view={layout.view ?? 'none'}
        data-ready={(onStage && ready) || undefined}
        data-resizing={viewport?.resizing || undefined}
        data-chips={stageConfig.flowChips}
        hidden={state.view === 'none'}
        style={vars}
        onClickCapture={recordOrigin}
      >
        {state.view === 'home' && (
          <h1 className={styles.srOnly} tabIndex={-1} data-stage-title="">TERMINAL 홈</h1>
        )}
        {onStage && sheetCount > 1 && layout.sheets.map((sheet, index) => (
          <span key={index} className={styles.sheet} aria-hidden="true" style={{ top: sheet.y, height: sheet.h }} />
        ))}
        {onStage && layout.indexOpen && (
          <span
            className={styles.openSlot}
            aria-hidden="true"
            style={{ transform: `translate(${layout.indexOpen.x}px, ${layout.indexOpen.y}px)`, width: layout.indexOpen.w, height: layout.indexOpen.h }}
          >
            <b>OPEN</b>
          </span>
        )}
        <Box
          rect={onStage && size ? layout.back ?? { x: 0, y: 0, w: Math.round(size.w * 0.2), h: 110 } : null}
          visible={!!layout.back && !!backHref}
          contentKey={backHref ?? 'none'}
          className={styles.backBox}
          surface="deep"
          data={{ back: '' }}
        >
          {backHref && previous ? <BackCard href={backHref} target={previous} data={data} /> : null}
        </Box>
        {PLATE_ORDER.map(id => {
          const placed = layout.plates[id];
          const order = shrinking.indexOf(id);
          return (
            <Box
              key={id}
              rect={rect(placed.rect)}
              visible={placed.mode !== 'hidden'}
              contentKey={placed.mode}
              className={styles.plate}
              surface={plateSurface(id, placed.mode, data)}
              delay={order < 0 ? 0 : (order + 1) * SHRINK_STAGGER}
              data={{ plate: id, mode: placed.mode }}
            >
              <PlateContent id={id} mode={placed.mode} state={state} data={data} query={query} size={onStage ? placed.rect : null} />
            </Box>
          );
        })}
        {data.ordered.map(event => {
          const itemKey = carrierKey('event', event.id);
          const placed = layout.items[itemKey];
          return placed && (
            <CarrierBox key={itemKey} itemKey={itemKey} placed={placed} rect={rect(placed.rect)} origin={origin} surface={shape => eventSurface(event, shape)}>
              {shape => <EventItem event={event} shape={shape} state={state} data={data} />}
            </CarrierBox>
          );
        })}
        {data.profiles.map(profile => {
          const itemKey = carrierKey('artist', profile.key);
          const placed = layout.items[itemKey];
          return placed && (
            <CarrierBox key={itemKey} itemKey={itemKey} placed={placed} rect={rect(placed.rect)} origin={origin} surface={shape => artistSurface(profile, shape)}>
              {shape => <ArtistItem profile={profile} shape={shape} state={state} data={data} />}
            </CarrierBox>
          );
        })}
        {list && list.pages > 1 && (
          <Box as="nav" rect={rect(list.pager)} visible contentKey="pager" className={styles.pagerBox} label="목록 쪽 이동" data={{ pager: list.kind }}>
            <div className={styles.pager}>
              {list.page > 1 ? <Link href={listHref(list.kind, list.page - 1)} scroll={false}>이전 쪽</Link> : <span>이전 쪽</span>}
              <span aria-hidden="true">{pageReadout(list.page, list.pages)}</span>
              <span className={styles.srOnly} aria-live="polite">{pageAnnouncement(list.page, list.pages)}</span>
              {list.page < list.pages ? <Link href={listHref(list.kind, list.page + 1)} scroll={false}>다음 쪽</Link> : <span>다음 쪽</span>}
            </div>
          </Box>
        )}
      </div>
    </StageModeContext.Provider>
  );
}

/**
 * A carrier's box. Folded, it keeps the shape it last had while it fades, and a folded detail
 * drops its heavy content once it is out of sight.
 */
function CarrierBox({ itemKey, placed, rect, origin, surface, children }: {
  itemKey: string;
  placed: PlacedItem;
  rect: Rect | null;
  origin: Origin | null;
  surface: (shape: ItemShape) => Surface;
  children: (shape: ItemShape) => ReactNode;
}) {
  const [shape, setShape] = useState<ItemShape>(placed.mode === 'folded' ? 'row' : placed.mode);
  if (placed.mode !== 'folded' && placed.mode !== shape) setShape(placed.mode);
  useEffect(() => {
    if (placed.mode !== 'folded' || shape !== 'detail') return;
    const timer = window.setTimeout(() => setShape('row'), DETAIL_REST_MS);
    return () => window.clearTimeout(timer);
  }, [placed.mode, shape]);
  return (
    <Box
      rect={rect}
      visible={placed.visible}
      contentKey={shape}
      className={styles.item}
      surface={surface(shape)}
      order={placed.order}
      origin={origin?.item === itemKey ? origin : null}
      data={{ item: itemKey, mode: placed.mode, shape }}
    >
      {children(shape)}
    </Box>
  );
}
