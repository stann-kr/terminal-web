'use client';
import { useLayoutEffect, useMemo, useState } from 'react';
import { getDefaultEvent, getFutureUpcomingEvent } from '@/lib/events/lifecycle';
import type { TerminalEvent } from '@/lib/events/types';
import { useEvents } from '@/features/events/data';
import { orderEventDirectory } from '@/features/events/model';
import { buildArtistArchive, type ArtistProfile } from '@/features/artists/model';
import { stageConfig } from './config';

export interface StageData {
  events: TerminalEvent[] | null;
  now: Date;
  /** Live, upcoming by start, then past: the directory order. */
  ordered: TerminalEvent[];
  /** Public artists by name. */
  profiles: ArtistProfile[];
  eventIds: ReadonlySet<string> | null;
  artistKeys: ReadonlySet<string> | null;
  /** The session the next-session plate shows: the next upcoming one, or the latest. */
  next: TerminalEvent | null;
}

const byName = (a: ArtistProfile, b: ArtistProfile) => a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key);

/** The stage reads events once and hands every plate and carrier the same data. */
export function useStageData() {
  const query = useEvents();
  const { events = null, now } = query;
  const data = useMemo<StageData>(() => {
    if (!events) return { events: null, now, ordered: [], profiles: [], eventIds: null, artistKeys: null, next: null };
    const ordered = orderEventDirectory(events, now);
    const profiles = buildArtistArchive(events).sort(byName);
    return {
      events,
      now,
      ordered,
      profiles,
      eventIds: new Set(ordered.map(event => event.id)),
      artistKeys: new Set(profiles.map(profile => profile.key)),
      next: getFutureUpcomingEvent(events, now) ?? getDefaultEvent(events, now),
    };
  }, [events, now]);
  return { data, query };
}

export type Viewport = { w: number; h: number; resizing: boolean };

/** How long the window must hold still before a resize counts as finished (ms). */
const RESIZE_SETTLE_MS = 150;

/** Without `svh`, a touch browser's height change of less than this at the same width is its toolbar. */
const TOOLBAR_SLACK = 120;

/**
 * The window size, measured before the first paint and followed on every frame of a resize;
 * `resizing` holds while the window is being dragged. Null on the server.
 *
 * The height is the small viewport (`100svh`, browser toolbars shown). Mobile browsers slide their
 * toolbars in and out while the page scrolls, which changes `innerHeight` and fires `resize`; the
 * small viewport stays put, so scrolling never re-tiles the stage. A resize that leaves the size as
 * it was is ignored altogether.
 */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let settle = 0;
    const probe = typeof CSS !== 'undefined' && CSS.supports?.('height', '100svh') ? document.createElement('div') : null;
    if (probe) {
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    let last: { w: number; h: number } | null = null;
    const measure = () => {
      const small = probe ? Math.round(probe.getBoundingClientRect().height) : 0;
      const size = { w: window.innerWidth, h: small > 0 ? small : window.innerHeight };
      // No steady `svh` reading: at the same width, a small height change on a touch screen is the toolbar.
      if (small <= 0 && touch && last && size.w === last.w && Math.abs(size.h - last.h) < TOOLBAR_SLACK) return last;
      return size;
    };
    const commit = (size: { w: number; h: number }, resizing: boolean) => {
      last = size;
      setViewport(previous => (previous && previous.w === size.w && previous.h === size.h && previous.resizing === resizing ? previous : { ...size, resizing }));
    };
    commit(measure(), false);
    const resize = () => {
      const size = measure();
      if (last && size.w === last.w && size.h === last.h) return;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          commit(measure(), true);
        });
      }
      window.clearTimeout(settle);
      settle = window.setTimeout(() => commit(measure(), false), RESIZE_SETTLE_MS);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener('resize', resize);
      probe?.remove();
    };
  }, []);
  return viewport;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

/** The stage's size in a window: the frame's side gutters and padding come off, as the shell's CSS lays them out. */
export function stageSizeFor(viewport: Viewport, config = stageConfig) {
  const gutter = clamp(10, viewport.w * 0.014, 24);
  return { w: Math.floor(viewport.w - 2 * gutter), h: Math.floor(viewport.h - 2 * config.frameY) };
}
