'use client';
import type { useEvents } from '@/features/events/data';
import type { Surface } from '@/features/ui/Ui';
import type { StageData } from '../data';
import type { PlateMode, Rect } from '../layout';
import type { CarrierKind, PlateId, StageState } from '../state';
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
  /** The plate's arrival rect on the stage; null in flow mode, where it sizes to its content. */
  size: Rect | null;
  /** How many carriers sit on each home plate as cells (stage mode). */
  homeCells: Record<CarrierKind, number>;
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
 * Plate colours: each plate keeps its identity in the rail and on the home; an open plate that
 * holds panels of its own becomes the deep bay they sit in.
 */
export function plateSurface(id: PlateId, mode: PlateMode, data: StageData): Surface {
  if (id === 'next') {
    const status = data.next?.status;
    return !data.next || status === 'ARCHIVED' ? 'cream' : status === 'LIVE' ? 'red' : 'orange';
  }
  if (mode === 'focus' && (id === 'log' || id === 'signal' || id === 'about')) return 'deep';
  if (id === 'signal') return 'red';
  if (id === 'about') return 'gold';
  return 'navy';
}
