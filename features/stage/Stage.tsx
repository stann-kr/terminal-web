'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { stageConfig } from './config';
import { stageSizeFor, useStageData, useViewport } from './data';
import { Box } from './Box';
import { computeFlowLayout, computeLayout, stageMetrics, type PlacedItem, type Rect, type StageLayout } from './layout';
import { decideStageMode, type StageMode } from './mode';
import {
  PLATE_ORDER,
  carrierKey,
  parseCarrierMark,
  resolveMissing,
  stageOrigin,
  stageParentHref,
  stateKey,
  type CarrierKind,
  type PlateId,
  type StageState,
} from './state';
import { StageModeContext, pageAnnouncement, pageKey, pageReadout, useWheelPaging, type StageRenderMode } from './usePaging';
import { PlateContent, plateSurface } from './plates/Plates';
import { EventItem, eventSurface, type ItemShape } from './plates/EventItem';
import { ArtistItem, artistSurface } from './plates/ArtistItem';
import type { Surface } from '@/features/ui/Ui';
import styles from './stage.module.css';

/** Rail plates leave one after another, this far apart (ms). */
const RAIL_STAGGER = 30;

type Failure = { key: string; w: number; h: number };
type Origin = { item: string; token: number; rect: Rect };

const listHref = (kind: CarrierKind, page: number) => `${kind === 'event' ? '/events' : '/artists'}${page > 1 ? `?page=${page}` : ''}`;

function typing(target: EventTarget | null) {
  return !!(target as Element | null)?.closest?.('input, textarea, select, [contenteditable=true]');
}

/** The first title of the current view that is not on its way out. */
function viewTitle(root: HTMLElement): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-stage-title]')].find(node => !node.closest('[inert]')) ?? null;
}

/** True when shown content spills out of a box it was given on the stage. */
function overflowing(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[data-fit]')].some(
    node => !node.closest('[inert]') && (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1),
  );
}

/**
 * The stage: six plates and one element per event and artist, all living here for the whole visit.
 * The address decides the state, the state decides the layout, and each element travels to its
 * new rect. When the window is too small, or content would not fit, it becomes an ordinary
 * scrolling page instead (flow mode) with the same elements in document order.
 */
export function Stage({ state: address }: { state: StageState }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const { data, query } = useStageData();
  const state = resolveMissing(address, data);
  const key = stateKey(state);
  const viewport = useViewport();

  // ── Mode ────────────────────────────────────────────────────────────────────────────────
  const [failure, setFailure] = useState<Failure | null>(null);
  const [lastMode, setLastMode] = useState<StageMode | null>(null);
  const items = {
    event: { order: data.ordered.map(event => event.id), page: state.view === 'plate' && state.plate === 'events' ? state.page : 1 },
    artist: { order: data.profiles.map(profile => profile.key), page: state.view === 'plate' && state.plate === 'artists' ? state.page : 1 },
  };
  const size = viewport ? stageSizeFor(viewport) : null;
  const staged = viewport && size && state.view !== 'none' ? computeLayout(state, size, { viewportW: viewport.w, items }) : null;
  const failed = failure?.key === key ? failure : null;
  const mode: StageRenderMode = !viewport
    ? 'boot'
    : decideStageMode({ viewport, fit: failed ? { required: failed.h + 1, available: viewport.h } : null, layoutFits: staged?.fits ?? true }, lastMode);
  if (mode !== 'boot' && mode !== lastMode) setLastMode(mode);
  const layout: StageLayout = mode === 'stage' && staged ? staged : computeFlowLayout(state, { items });
  const onStage = mode === 'stage';

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (mode === 'boot') return;
    html.dataset.stageMode = mode;
    if (mode === 'stage') window.scrollTo(0, 0);
    return () => {
      delete html.dataset.stageMode;
    };
  }, [mode]);

  // Transitions start only once the first stage layout has painted, so nothing flies in from 0,0.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    // Leaving the stage resets this, so coming back from flow also starts without transitions.
    if (!onStage) {
      if (ready) setReady(false);
      return;
    }
    if (ready) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [onStage, ready]);

  // Content that spills out of its box sends this view to flow mode (never clipped). Checked after
  // every change inside the stage and when the fonts arrive, before the frame paints.
  useEffect(() => {
    const element = root.current;
    if (!onStage || !element || !viewport) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      if (overflowing(element)) flushSync(() => setFailure({ key, w: viewport.w, h: viewport.h }));
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
  }, [onStage, key, viewport]);

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
  const turn = (page: number, replace = false) => {
    if (!list) return;
    const href = listHref(list.kind, page);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };
  const listTurns = {
    prev: list && list.page > 1 ? () => turn(list.page - 1, true) : undefined,
    next: list && list.page < list.pages ? () => turn(list.page + 1, true) : undefined,
  };
  useWheelPaging(root, listTurns, onStage && !!list);

  const latest = useRef({ state, list });
  useEffect(() => {
    latest.current = { state, list };
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      const current = latest.current;
      if (event.key === 'Escape') {
        const up = stageParentHref(current.state);
        if (up) {
          event.preventDefault();
          router.push(up, { scroll: false });
        }
        return;
      }
      const direction = pageKey(event);
      const inside = (event.target as Element | null)?.closest?.('[data-pages]');
      if (!direction || inside || !current.list || !root.current?.contains(document.activeElement)) return;
      const page = current.list.page + (direction === 'next' ? 1 : -1);
      if (page < 1 || page > current.list.pages) return;
      event.preventDefault();
      router.push(listHref(current.list.kind, page), { scroll: false });
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [router]);

  // ── Render ──────────────────────────────────────────────────────────────────────────────
  const metrics = viewport ? stageMetrics(viewport.w) : null;
  const vars = (size && metrics && onStage
    ? {
        '--stage-w': `${size.w}px`,
        '--stage-h': `${size.h}px`,
        '--list-head': `${metrics.listHead}px`,
        '--pager-h': `${metrics.pagerH}px`,
        '--tile-head': `${metrics.tileHead}px`,
        '--strip-h': `${metrics.stripH}px`,
      }
    : {}) as CSSProperties;
  const railOrder = PLATE_ORDER.filter(id => layout.plates[id].mode === 'rail');
  const rect = (value: Rect) => (onStage ? value : null);

  return (
    <StageModeContext.Provider value={mode}>
      <div
        ref={root}
        id="stage"
        tabIndex={-1}
        className={styles.stage}
        data-stage={mode}
        data-view={state.view}
        data-ready={(onStage && ready) || undefined}
        data-chips={stageConfig.flowChips}
        hidden={state.view === 'none'}
        style={vars}
        onClickCapture={recordOrigin}
      >
        {state.view === 'home' && (
          <h1 className={styles.srOnly} tabIndex={-1} data-stage-title="">TERMINAL 홈</h1>
        )}
        {onStage && layout.rail && <RailSlots rail={layout.rail} open={layout.openSlots} />}
        {PLATE_ORDER.map(id => {
          const placed = layout.plates[id];
          return (
            <Box
              key={id}
              rect={rect(placed.rect)}
              visible={placed.mode !== 'hidden'}
              contentKey={placed.mode}
              className={styles.plate}
              surface={plateSurface(id, placed.mode, data)}
              delay={placed.mode === 'rail' ? railOrder.indexOf(id) * RAIL_STAGGER : 0}
              data={{ plate: id, mode: placed.mode }}
            >
              <PlateContent id={id} mode={placed.mode} state={state} data={data} query={query} size={onStage ? placed.rect : null} homeCells={layout.homeCells} />
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
              {list.page > 1 ? <Link href={listHref(list.kind, list.page - 1)} scroll={false}>← 이전</Link> : <span>이전</span>}
              <span aria-hidden="true">{pageReadout(list.page, list.pages)}</span>
              <span className={styles.srOnly} aria-live="polite">{pageAnnouncement(list.page, list.pages)}</span>
              {list.page < list.pages ? <Link href={listHref(list.kind, list.page + 1)} scroll={false}>다음 →</Link> : <span>다음</span>}
            </div>
          </Box>
        )}
      </div>
    </StageModeContext.Provider>
  );
}

/** How long a folded detail keeps its full content before it rests as a light row (ms). */
const DETAIL_REST_MS = 700;

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

/** The rail's fixed slots; the slot of a plate that is open elsewhere shows as an empty, lit cell. */
function RailSlots({ rail, open }: { rail: Record<PlateId, Rect>; open: PlateId[] }) {
  return (
    <div aria-hidden="true">
      {PLATE_ORDER.map(id => (
        <span
          key={id}
          className={styles.slot}
          data-open={open.includes(id) || undefined}
          style={{ transform: `translate(${rail[id].x}px, ${rail[id].y}px)`, width: rail[id].w, height: rail[id].h }}
        >
          {open.includes(id) && <b>OPEN</b>}
        </span>
      ))}
    </div>
  );
}
