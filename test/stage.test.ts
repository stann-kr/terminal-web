import { beforeEach, describe, expect, it } from 'vitest';
import { PLATE_ORDER, resolveMissing, stageOrigin, stageParentHref, stageStateFromUrl, type StageState } from '../features/stage/state';
import { computeLayout, listRowsPerPage, stageMetrics, type Rect, type StageLayout } from '../features/stage/layout';
import { decideStageMode, MODE_HYSTERESIS } from '../features/stage/mode';

describe('stage state from the address', () => {
  it('maps every stage route to its state', () => {
    const cases: [string, string, StageState][] = [
      ['/', '', { view: 'home' }],
      ['/events', '?page=3', { view: 'plate', plate: 'events', page: 3 }],
      ['/events/TRM-02', '', { view: 'session', eventId: 'TRM-02', request: false }],
      ['/events/TRM%2002/request', '', { view: 'session', eventId: 'TRM 02', request: true }],
      ['/artists', '?page=2', { view: 'plate', plate: 'artists', page: 2 }],
      ['/artists/stann-lumo', '', { view: 'artist', artistKey: 'stann-lumo' }],
      ['/transmit', '?page=4', { view: 'plate', plate: 'log', page: 4 }],
      ['/signal', '?page=9', { view: 'plate', plate: 'signal', page: 1 }],
      ['/about/', '', { view: 'plate', plate: 'about', page: 1 }],
    ];
    for (const [path, search, state] of cases) expect(stageStateFromUrl(path, new URLSearchParams(search)), path).toEqual(state);
    expect(stageStateFromUrl('/events', { page: '2' })).toEqual({ view: 'plate', plate: 'events', page: 2 });
  });

  it('reads malformed pages as the first page and malformed ids as the parent plate', () => {
    for (const page of ['0', '-1', '1.5', 'abc', '1001', '']) {
      expect(stageStateFromUrl('/events', new URLSearchParams({ page }))).toMatchObject({ page: 1 });
    }
    expect(stageStateFromUrl('/events', { page: ['2', '3'] })).toMatchObject({ page: 1 });
    expect(stageStateFromUrl('/events/%E0%A4%A')).toEqual({ view: 'plate', plate: 'events', page: 1 });
    expect(stageStateFromUrl('/artists/%')).toEqual({ view: 'plate', plate: 'artists', page: 1 });
  });

  it('leaves unknown paths and deeper segments off the stage', () => {
    for (const path of ['/nope', '/api/events', '/events/TRM-02/other', '/artists/a/b', '/signal/x']) {
      expect(stageStateFromUrl(path), path).toEqual({ view: 'none' });
    }
  });

  it('turns an unknown detail into its parent plate once the data is known, not before', () => {
    const session = stageStateFromUrl('/events/TRM-99');
    expect(resolveMissing(session, { eventIds: null, artistKeys: null })).toBe(session);
    expect(resolveMissing(session, { eventIds: new Set(['TRM-01']), artistKeys: null })).toEqual({ view: 'plate', plate: 'events', page: 1, missing: { kind: 'event', id: 'TRM-99' } });
    expect(resolveMissing(stageStateFromUrl('/artists/ghost'), { eventIds: null, artistKeys: new Set(['stann-lumo']) })).toMatchObject({ plate: 'artists', missing: { kind: 'artist', id: 'ghost' } });
    expect(resolveMissing(session, { eventIds: new Set(['TRM-99']), artistKeys: null })).toBe(session);
  });

  it('goes one level up: request → session → list → home', () => {
    expect(stageParentHref(stageStateFromUrl('/events/TRM-02/request'))).toBe('/events/TRM-02');
    expect(stageParentHref(stageStateFromUrl('/events/TRM-02'))).toBe('/events');
    expect(stageParentHref(stageStateFromUrl('/artists/lucii'))).toBe('/artists');
    expect(stageParentHref(stageStateFromUrl('/transmit'))).toBe('/');
    expect(stageParentHref({ view: 'home' })).toBeNull();
  });
});

describe('carrier memory', () => {
  beforeEach(() => void stageOrigin.take({ view: 'home' }));

  it('hands the recorded carrier to its own detail exactly once', () => {
    const session = stageStateFromUrl('/events/TRM-02');
    stageOrigin.record({ kind: 'event-row', id: 'TRM-02' });
    expect(stageOrigin.take(session)).toEqual({ kind: 'event-row', id: 'TRM-02' });
    expect(stageOrigin.take(session)).toBeNull();
  });

  it('drops a carrier recorded for another detail or kind', () => {
    stageOrigin.record({ kind: 'event-row', id: 'TRM-01' });
    expect(stageOrigin.take(stageStateFromUrl('/events/TRM-02'))).toBeNull();
    stageOrigin.record({ kind: 'artist-cell', id: 'TRM-02' });
    expect(stageOrigin.take(stageStateFromUrl('/events/TRM-02'))).toBeNull();
    stageOrigin.record({ kind: 'slot-row', id: 'lucii' });
    expect(stageOrigin.take(stageStateFromUrl('/artists/lucii'))).toEqual({ kind: 'slot-row', id: 'lucii' });
  });
});

// Stage sizes under a 56px status line and a 28px ticker: 1440×900, 1280×720, 1920×1080, 1024×680.
const STAGES = [
  { viewportW: 1440, stage: { w: 1392, h: 816 } },
  { viewportW: 1280, stage: { w: 1244, h: 636 } },
  { viewportW: 1920, stage: { w: 1872, h: 996 } },
  { viewportW: 1024, stage: { w: 1000, h: 596 } },
];
const ROWS = ['TRM-05', 'TRM-04', 'TRM-03', 'TRM-02', 'TRM-01'];
const CELLS = ['stann-lumo', 'lucii', 'marcus-l', 'nusnoom'];
const STATES: [string, Parameters<typeof computeLayout>[2]][] = [
  ['/', { items: { kind: 'event-row', ids: ROWS } }],
  ['/events', { items: { kind: 'event-row', ids: ROWS } }],
  ['/events/TRM-02', { items: { kind: 'event-row', ids: ROWS }, carrier: { kind: 'event-row', id: 'TRM-02' } }],
  ['/events/TRM-05', { carrier: { kind: 'next-plate', id: 'TRM-05' } }],
  ['/events/TRM-01/request', {}],
  ['/artists', { items: { kind: 'artist-cell', ids: CELLS } }],
  ['/artists/lucii', { items: { kind: 'artist-cell', ids: CELLS }, carrier: { kind: 'artist-cell', id: 'lucii' } }],
  ['/transmit', {}],
  ['/signal', {}],
  ['/about', {}],
];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: Rect, inner: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const shownPlates = (layout: StageLayout) => PLATE_ORDER.filter(id => layout.plates[id].mode !== 'hidden').map(id => layout.plates[id].rect);

describe('stage layout', () => {
  it('keeps every shown plate and item on the stage, apart from each other', () => {
    for (const { viewportW, stage } of STAGES) {
      for (const [path, input] of STATES) {
        const layout = computeLayout(stageStateFromUrl(path), stage, { viewportW, ...input });
        const label = `${viewportW} ${path}`;
        expect(layout.fits, label).toBe(true);
        const plates = shownPlates(layout);
        plates.forEach((a, i) => plates.slice(i + 1).forEach(b => expect(overlaps(a, b), label).toBe(false)));
        const items = Object.entries(layout.items).filter(([, item]) => item.visible);
        items.forEach(([, a], i) => items.slice(i + 1).forEach(([, b]) => expect(overlaps(a.rect, b.rect), label).toBe(false)));
        for (const [key, item] of items) {
          if (key === layout.detail?.carrierId) continue;
          const owner = key.startsWith('event-row') ? layout.plates.events : layout.plates.artists;
          expect(owner.mode, label).toBe('focus');
          expect(contains(owner.rect, item.rect), `${label} ${key}`).toBe(true);
        }
      }
    }
  });

  it('lays the home out as three columns with the next session largest', () => {
    const { plates, rail } = computeLayout({ view: 'home' }, STAGES[0].stage, { viewportW: 1440 });
    expect(rail).toBeNull();
    expect(PLATE_ORDER.every(id => plates[id].mode === 'tile')).toBe(true);
    expect(plates.next.rect.h).toBe(STAGES[0].stage.h);
    expect(plates.events.rect.x).toBe(plates.artists.rect.x);
    expect(plates.about.rect.x).toBe(plates.signal.rect.x);
    expect(plates.next.rect.w).toBeGreaterThan(plates.events.rect.w);
    expect(plates.about.rect.w).toBeGreaterThanOrEqual(260);
    const narrow = computeLayout({ view: 'home' }, STAGES[3].stage, { viewportW: 1024 });
    expect(narrow.plates.about.rect.w).toBeGreaterThanOrEqual(260);
  });

  it('keeps the rail in its fixed order with the open plate’s slot left empty', () => {
    for (const path of ['/events', '/transmit', '/events/TRM-02', '/artists/lucii']) {
      const layout = computeLayout(stageStateFromUrl(path), STAGES[0].stage, { viewportW: 1440 });
      const slots = PLATE_ORDER.map(id => layout.rail![id]);
      slots.forEach((slot, i) => i && expect(slot.y).toBeGreaterThan(slots[i - 1].y));
      expect(new Set(slots.map(slot => slot.h)).size).toBeLessThanOrEqual(2);
      for (const id of PLATE_ORDER) {
        const plate = layout.plates[id];
        if (plate.mode === 'rail') expect(plate.rect).toEqual(layout.rail![id]);
        else expect(layout.openSlots).toContain(id);
      }
    }
    expect(computeLayout(stageStateFromUrl('/events/TRM-02'), STAGES[0].stage).openSlots).toEqual(['events']);
  });

  it('grows the carrier into the detail rect, under the parent strip', () => {
    const state = stageStateFromUrl('/events/TRM-02');
    const layout = computeLayout(state, STAGES[0].stage, { viewportW: 1440, items: { kind: 'event-row', ids: ROWS }, carrier: { kind: 'event-row', id: 'TRM-02' } });
    expect(layout.detail).toEqual({ rect: layout.items['event-row:TRM-02'].rect, carrierId: 'event-row:TRM-02' });
    expect(layout.plates.events.mode).toBe('strip');
    expect(layout.plates.events.rect.h).toBe(64);
    expect(layout.detail!.rect.y).toBeGreaterThan(layout.plates.events.rect.y + 64);
    const others = ROWS.filter(id => id !== 'TRM-02').map(id => layout.items[`event-row:${id}`]);
    expect(others.every(item => !item.visible && item.rect === layout.plates.events.rect)).toBe(true);

    const fromNext = computeLayout(state, STAGES[0].stage, { viewportW: 1440, carrier: { kind: 'next-plate', id: 'TRM-02' } });
    expect(fromNext.plates.next).toEqual({ mode: 'detail', rect: fromNext.detail!.rect });
    expect(fromNext.openSlots).toEqual(['next', 'events']);

    const direct = computeLayout(state, STAGES[0].stage, { viewportW: 1440 });
    expect(direct.detail).toMatchObject({ carrierId: null, rect: layout.detail!.rect });
  });

  it('pages the list by the rows that fit, never fewer than three', () => {
    const metrics = stageMetrics(1440);
    const layout = computeLayout(stageStateFromUrl('/events'), STAGES[0].stage, { viewportW: 1440, items: { kind: 'event-row', ids: ROWS } });
    const expected = Math.floor((layout.focus!.h - 120 - 56 + 6) / (92 + 6));
    expect(layout.perPage).toBe(expected);
    expect(Object.values(layout.items).filter(item => item.visible)).toHaveLength(Math.min(ROWS.length, expected));
    expect(listRowsPerPage(300, metrics)).toBe(3);
    expect(stageMetrics(1200).rowH).toBe(80);
  });

  it('is deterministic for the same state and size', () => {
    const state = stageStateFromUrl('/artists/lucii');
    const input = { items: { kind: 'artist-cell' as const, ids: CELLS }, carrier: { kind: 'roster-cell' as const, id: 'lucii' } };
    expect(computeLayout(state, STAGES[1].stage, input)).toEqual(computeLayout(state, STAGES[1].stage, input));
  });

  it('reports a stage too small for its shown elements', () => {
    expect(computeLayout(stageStateFromUrl('/events'), { w: 1000, h: 200 }, { items: { kind: 'event-row', ids: ROWS } }).fits).toBe(false);
  });
});

describe('stage mode', () => {
  const fit = (required: number, available = 600) => ({ required, available });

  it('uses the stage only when the window and the content both fit', () => {
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, fit: fit(500) })).toBe('stage');
    expect(decideStageMode({ viewport: { w: 1024, h: 680 } })).toBe('stage');
    expect(decideStageMode({ viewport: { w: 1023, h: 900 } })).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1440, h: 679 } })).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, fit: fit(601) })).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, layoutFits: false })).toBe('flow');
  });

  it('leaves the stage at the limit but returns only with room to spare', () => {
    expect(decideStageMode({ viewport: { w: 1023, h: 900 } }, 'stage')).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, fit: fit(601) }, 'stage')).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1024 + MODE_HYSTERESIS - 1, h: 900 } }, 'flow')).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1024 + MODE_HYSTERESIS, h: 680 + MODE_HYSTERESIS } }, 'flow')).toBe('stage');
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, fit: fit(600 - MODE_HYSTERESIS + 1) }, 'flow')).toBe('flow');
    expect(decideStageMode({ viewport: { w: 1440, h: 900 }, fit: fit(600 - MODE_HYSTERESIS) }, 'flow')).toBe('stage');
  });
});
