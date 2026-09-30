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

export type Viewport = { w: number; h: number };

/** The window size, measured before the first paint and on every resize; null on the server. */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = { w: window.innerWidth, h: window.innerHeight };
      setViewport(previous => (previous && previous.w === next.w && previous.h === next.h ? previous : next));
    };
    read();
    const resize = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return viewport;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The stage's size in a window: the frame's side gutters and vertical padding, the status line,
 * the ticker and the gaps between them come off, exactly as the shell's CSS lays them out.
 */
export function stageSizeFor(viewport: Viewport, config = stageConfig) {
  const gutter = clamp(10, viewport.w * 0.014, 24);
  const gap = clamp(8, viewport.w * 0.007, 12);
  const bars = config.statusH + gap + (config.ticker ? config.tickerH + gap : 0);
  return { w: Math.floor(viewport.w - 2 * gutter), h: Math.floor(viewport.h - 2 * config.frameY - bars) };
}
