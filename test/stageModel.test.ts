import { describe, expect, it } from 'vitest';
import { activePlate, PLATE_ORDER, plateState, stageStateFromUrl, type StageState } from '../features/stage/state';
import { computeLayout, eventPageSize, eventRowRects, focusRect, type Rect } from '../features/stage/layout';
import { resolveStageMode } from '../features/stage/mode';

describe('URL-owned stage state', () => {
  it.each([
    ['/', { view: 'home' }],
    ['/events', { view: 'plate', plate: 'events', page: 1 }],
    ['/artists', { view: 'plate', plate: 'artists', page: 1 }],
    ['/transmit', { view: 'plate', plate: 'log', page: 1 }],
    ['/signal', { view: 'plate', plate: 'signal', page: 1 }],
    ['/about/', { view: 'plate', plate: 'about', page: 1 }],
    ['/events/TRM-02', { view: 'session', eventId: 'TRM-02', request: false }],
    ['/events/TRM-02/request', { view: 'session', eventId: 'TRM-02', request: true }],
    ['/artists/stann-lumo', { view: 'artist', artistKey: 'stann-lumo' }],
  ])('maps %s without browser state', (path, state) => {
    expect(stageStateFromUrl(path as string)).toEqual(state);
  });
  it('uses the existing strict page contract and the first repeated value', () => {
    for (const page of ['', '0', '-1', '1.5', '01', '1e2', '1001', '99999999999999999', 'NaN']) {
      expect(stageStateFromUrl('/events', new URLSearchParams({ page }))).toMatchObject({ page: 1 });
    }
    expect(stageStateFromUrl('/events', new URLSearchParams('page=12&page=3'))).toMatchObject({ page: 12 });
    expect(stageStateFromUrl('/transmit', new URLSearchParams('page=1000'))).toMatchObject({ page: 1000 });
  });
  it('decodes opaque IDs once and leaves missing-data decisions to the data owner', () => {
    expect(stageStateFromUrl('/events/A%252FB')).toMatchObject({ eventId: 'A%2FB' });
    expect(stageStateFromUrl('/artists/%ED%95%9C%EA%B8%80')).toMatchObject({ artistKey: '한글' });
    expect(stageStateFromUrl('/events/unknown')).toMatchObject({ view: 'session', eventId: 'unknown' });
    expect(stageStateFromUrl('/events/%E0%A4%A')).toBeNull();
  });
  it('does not hijack legacy redirects or unknown route boundaries', () => {
    for (const route of ['/archive', '/boot', '/gate', '/gate/request', '/home', '/idle', '/lineup', '/link', '/status', '/missing', '/artists/a/request', '/events/a/b']) {
      expect(stageStateFromUrl(route)).toBeNull();
    }
    expect(stageStateFromUrl('/events', new URLSearchParams('selected=TRM-02'))).toEqual({ view: 'plate', plate: 'events', page: 1 });
  });
  it('keeps one active parent and turns only that plate into a strip for detail', () => {
    const detail: StageState = { view: 'session', eventId: 'A', request: false };
    expect(activePlate(detail)).toBe('events');
    expect(PLATE_ORDER.map(id => plateState(detail, id))).toEqual(['rail', 'strip', 'rail', 'rail', 'rail', 'rail']);
    expect(PLATE_ORDER.map(id => plateState({ view: 'home' }, id))).toEqual(PLATE_ORDER.map(() => 'tile'));
  });
});

function overlaps(a: Rect, b: Rect) {
  const epsilon = 0.001;
  return a.x < b.x + b.w - epsilon && a.x + a.w > b.x + epsilon
    && a.y < b.y + b.h - epsilon && a.y + a.h > b.y + epsilon;
}

describe('deterministic stage geometry', () => {
  const states: StageState[] = [
    { view: 'home' },
    ...PLATE_ORDER.map(plate => ({ view: 'plate' as const, plate, page: 1 })),
    { view: 'session', eventId: 'TRM-02', request: false },
    { view: 'artist', artistKey: 'stann-lumo' },
  ];
  it.each([{ w: 1392, h: 760 }, { w: 1244, h: 600 }, { w: 1872, h: 960 }, { w: 996, h: 570 }])('keeps plates inside $w × $h without collisions', stage => {
    for (const state of states) {
      const layout = computeLayout(state, stage);
      expect(computeLayout(state, stage)).toEqual(layout);
      const rects = [...PLATE_ORDER.map(id => layout[id]), ...(layout.detail ? [layout.detail] : [])];
      for (const rect of Object.values(layout)) {
        expect(rect).toBeDefined();
        if (!rect) continue;
        expect(Object.values(rect).every(Number.isFinite)).toBe(true);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.w).toBeGreaterThan(0);
        expect(rect.h).toBeGreaterThan(0);
        expect(rect.x + rect.w).toBeLessThanOrEqual(stage.w + 0.001);
        expect(rect.y + rect.h).toBeLessThanOrEqual(stage.h + 0.001);
      }
      rects.forEach((a, i) => rects.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)));
    }
  });
  it('leaves the open rail slot in the same position across focus and detail', () => {
    const stage = { w: 1392, h: 760 };
    const home = computeLayout({ view: 'home' }, stage);
    expect(home.next.w).toBeGreaterThan(home.events.w);
    expect(home.about.w).toBeGreaterThanOrEqual(260);
    const baseline = computeLayout({ view: 'plate', plate: 'events', page: 1 }, stage);
    for (const state of states.filter(state => state.view !== 'home')) {
      const result = computeLayout(state, stage);
      PLATE_ORDER.forEach((plate, index) => {
        expect(result[`rail:${plate}`]).toEqual(baseline[`rail:${plate}`]);
        if (index) expect(result[`rail:${plate}`]!.y).toBeGreaterThan(result[`rail:${PLATE_ORDER[index - 1]}`]!.y);
      });
    }
  });
  it('fits whole rows between header and pager, with page size following height', () => {
    const stage = { w: 1392, h: 760 };
    const rows = eventRowRects(stage);
    const focus = focusRect(stage);
    expect(rows.length).toBe(eventPageSize(stage));
    expect(rows[0].y).toBeGreaterThanOrEqual(120);
    expect(rows.at(-1)!.y + rows.at(-1)!.h).toBeLessThanOrEqual(focus.h - 56);
    rows.forEach((a, i) => rows.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)));
    expect(eventPageSize({ w: 1392, h: 600 })).toBeLessThan(eventPageSize(stage));
    expect(eventPageSize({ w: 996, h: 570 })).toBeGreaterThanOrEqual(3);
  });
  it('moves the selected carrier to exactly the detail rect and back to its row', () => {
    const stage = { w: 1392, h: 760 };
    const carrier = { kind: 'event-row' as const, id: 'TRM-02', index: 1 };
    const listing = computeLayout({ view: 'plate', plate: 'events', page: 1 }, stage, carrier);
    expect(listing['event:TRM-02']).toEqual(eventRowRects(stage)[1]);
    const detail = computeLayout({ view: 'session', eventId: 'TRM-02', request: false }, stage, carrier);
    expect(detail['event:TRM-02']).toEqual(detail.detail);
    const other = computeLayout({ view: 'session', eventId: 'TRM-01', request: false }, stage, carrier);
    expect(other['event:TRM-02']).toBeUndefined();
    expect(computeLayout({ view: 'session', eventId: 'TRM-02', request: false }, stage, { kind: 'next-plate' }).next).toEqual(detail.detail);
    expect(computeLayout({ view: 'artist', artistKey: 'a' }, stage, { kind: 'artist-cell', key: 'a', index: 0 })['artist:a']).toEqual(detail.detail);
  });
  it('rejects invalid measurements instead of emitting NaN CSS', () => {
    for (const w of [0, -1, Infinity, NaN]) expect(() => computeLayout({ view: 'home' }, { w, h: 760 })).toThrow(RangeError);
  });
});

describe('stage/flow safety and hysteresis', () => {
  const input = { viewport: { w: 1440, h: 900 }, minContentHeight: 600, availableHeight: 760 };
  it('falls back on narrow, short, overflowing or unknown measurements', () => {
    expect(resolveStageMode(input)).toBe('stage');
    expect(resolveStageMode({ ...input, viewport: { w: 1023, h: 900 } })).toBe('flow');
    expect(resolveStageMode({ ...input, viewport: { w: 1440, h: 679 } })).toBe('flow');
    expect(resolveStageMode({ ...input, minContentHeight: 761, previousMode: 'stage' })).toBe('flow');
    expect(resolveStageMode({ ...input, availableHeight: NaN })).toBe('flow');
    expect(resolveStageMode({ ...input, minContentHeight: -1 })).toBe('flow');
  });
  it('allows the initial exact boundary and requires 24px slack when re-entering', () => {
    const edge = { viewport: { w: 1024, h: 680 }, minContentHeight: 600, availableHeight: 600 };
    expect(resolveStageMode(edge)).toBe('stage');
    expect(resolveStageMode({ ...edge, previousMode: 'stage' })).toBe('stage');
    expect(resolveStageMode({ ...edge, previousMode: 'flow' })).toBe('flow');
    const reentry = { ...edge, viewport: { w: 1048, h: 704 }, availableHeight: 624, previousMode: 'flow' as const };
    expect(resolveStageMode(reentry)).toBe('stage');
    expect(resolveStageMode({ ...reentry, availableHeight: 623 })).toBe('flow');
    expect(resolveStageMode({ ...reentry, viewport: { w: 1047, h: 704 } })).toBe('flow');
    expect(resolveStageMode({ ...reentry, viewport: { w: 1048, h: 703 } })).toBe('flow');
  });
});
