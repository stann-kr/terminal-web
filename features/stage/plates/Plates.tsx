'use client';
import type { useEvents } from '@/features/events/data';
import type { Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import type { PlateMode, Rect } from '../layout';
import type { PlateId, StageState } from '../state';
import { NextPlate } from './NextPlate';
import { EventsPlate } from './EventsPlate';
import { ArtistsPlate } from './ArtistsPlate';
import { LogPlate } from './LogPlate';
import { SignalPlate } from './SignalPlate';
import { AboutPlate } from './AboutPlate';

export interface PlateProps {
  mode: PlateMode;
  state: StageState;
  data: StageData;
  query: ReturnType<typeof useEvents>;
  /** The plate's arrival rect on the stage; null before the stage is laid out. */
  size: Rect | null;
}

const PLATES: Record<PlateId, (props: PlateProps) => React.ReactNode> = {
  next: NextPlate,
  events: EventsPlate,
  artists: ArtistsPlate,
  log: LogPlate,
  signal: SignalPlate,
  about: AboutPlate,
};

export function PlateContent({ id, ...props }: PlateProps & { id: PlateId }) {
  if (props.mode === 'hidden') return null;
  const Plate = PLATES[id];
  return <Plate {...props} />;
}

/**
 * Plate colours: each plate keeps its identity at every size; an open plate that holds panels of
 * its own becomes the deep bay they sit in.
 */
export function plateSurface(id: PlateId, mode: PlateMode, data: StageData): Surface {
  if (id === 'next') {
    const status = data.next?.status;
    return !data.next || status === 'ARCHIVED' ? 'cream' : status === 'LIVE' ? 'red' : 'orange';
  }
  if (mode === 'hero' && (id === 'log' || id === 'signal' || id === 'about')) return 'deep';
  if (id === 'signal') return 'red';
  if (id === 'about') return 'gold';
  return 'navy';
}
