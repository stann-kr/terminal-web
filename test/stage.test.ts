import { beforeEach, describe, expect, it } from 'vitest';
import { PLATE_ORDER, parseCarrierMark, resolveMissing, stageOrigin, stageParentHref, stageStateFromUrl, stateKey, type StageState } from '../features/stage/state';
import { computeFlowLayout, computeLayout, listRowsPerPage, stageMetrics, type LayoutInput, type Rect, type StageLayout } from '../features/stage/layout';
import { stageConfig } from '../features/stage/config';
import { decideStageMode, MODE_HYSTERESIS } from '../features/stage/mode';
import { fitTitle, packHeights, paginate, type Measurer } from '../features/stage/text';

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

  it('reads malformed pages as the first page', () => {
    for (const page of ['0', '-1', '1.5', 'abc', '1001', '']) {
      expect(stageStateFromUrl('/events', new URLSearchParams({ page }))).toMatchObject({ page: 1 });
    }
    expect(stageStateFromUrl('/events', { page: ['2', '3'] })).toMatchObject({ page: 1 });
  });

  it('leaves undecodable ids, unknown paths and deeper segments to their own pages', () => {
    for (const path of ['/events/%E0%A4%A', '/artists/%', '/nope', '/api/events', '/events/TRM-02/other', '/artists/a/b', '/signal/x']) {
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

  it('keys each distinct view once, paging included', () => {
    expect(stateKey(stageStateFromUrl('/events', { page: '2' }))).not.toBe(stateKey(stageStateFromUrl('/events')));
    expect(stateKey(stageStateFromUrl('/events/A/request'))).not.toBe(stateKey(stageStateFromUrl('/events/A')));
  });
});

describe('carrier memory', () => {
  beforeEach(() => void stageOrigin.take({ view: 'home' }));
  const rect = { x: 1, y: 2, w: 3, h: 4 };

  it('hands the recorded origin to its own detail exactly once', () => {
    const session = stageStateFromUrl('/events/TRM-02');
    stageOrigin.record({ kind: 'event', id: 'TRM-02', rect });
    expect(stageOrigin.take(session)).toEqual({ kind: 'event', id: 'TRM-02', rect });
    expect(stageOrigin.take(session)).toBeNull();
  });

  it('drops an origin recorded for another detail or kind', () => {
    stageOrigin.record({ kind: 'event', id: 'TRM-01', rect });
    expect(stageOrigin.take(stageStateFromUrl('/events/TRM-02'))).toBeNull();
    stageOrigin.record({ kind: 'artist', id: 'TRM-02', rect });
    expect(stageOrigin.take(stageStateFromUrl('/events/TRM-02'))).toBeNull();
  });

  it('reads carrier marks, keys with colons included', () => {
    expect(parseCarrierMark('artist:appearance:OLD:PUBLIC')).toEqual({ kind: 'artist', id: 'appearance:OLD:PUBLIC' });
    expect(parseCarrierMark('plate:events')).toBeNull();
  });
});

// Stage sizes under the status line and the ticker, for 1440×900, 1280×720, 1920×1080 and 1024×680.
const STAGES = [
  { viewportW: 1440, stage: { w: 1400, h: 766 } },
  { viewportW: 1280, stage: { w: 1244, h: 590 } },
  { viewportW: 1920, stage: { w: 1872, h: 940 } },
  { viewportW: 1024, stage: { w: 1000, h: 540 } },
];
const EVENTS = ['TRM-09', 'TRM-08', 'TRM-07', 'TRM-06', 'TRM-05', 'TRM-04', 'TRM-03', 'TRM-02', 'TRM-01'];
const ARTISTS = ['stann-lumo', 'lucii', 'marcus-l', 'nusnoom', 'a', 'b', 'c', 'd', 'e'];
const items = (eventPage = 1, artistPage = 1): LayoutInput['items'] => ({ event: { order: EVENTS, page: eventPage }, artist: { order: ARTISTS, page: artistPage } });
const PATHS = ['/', '/events', '/events/TRM-02', '/events/TRM-01/request', '/artists', '/artists/lucii', '/transmit', '/signal', '/about'];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: Rect, inner: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const shownPlates = (layout: StageLayout) => PLATE_ORDER.filter(id => layout.plates[id].mode !== 'hidden').map(id => layout.plates[id].rect);
const shownItems = (layout: StageLayout) => Object.entries(layout.items).filter(([, item]) => item.visible);

describe('stage layout', () => {
  it('keeps every shown plate and carrier on the stage, plates apart, carriers inside their plate or the detail', () => {
    for (const { viewportW, stage } of STAGES) {
      for (const path of PATHS) {
        const layout = computeLayout(stageStateFromUrl(path), stage, { viewportW, items: items() });
        const label = `${viewportW} ${path}`;
        expect(layout.fits, label).toBe(true);
        const plates = shownPlates(layout);
        plates.forEach((a, i) => plates.slice(i + 1).forEach(b => expect(overlaps(a, b), label).toBe(false)));
        const shown = shownItems(layout);
        shown.forEach(([, a], i) => shown.slice(i + 1).forEach(([, b]) => expect(overlaps(a.rect, b.rect), label).toBe(false)));
        for (const [key, item] of shown) {
          if (item.mode === 'detail') {
            expect(item.rect, `${label} ${key}`).toEqual(layout.detail);
            continue;
          }
          const owner = key.startsWith('event:') ? layout.plates.events : layout.plates.artists;
          expect(contains(owner.rect, item.rect), `${label} ${key}`).toBe(true);
          if (layout.list) expect(item.rect.y + item.rect.h, `${label} ${key}`).toBeLessThanOrEqual(layout.list.pager.y);
        }
      }
    }
  });

  it('lays the home out by the configured columns, next session largest, side column wide enough', () => {
    const { plates, rail, homeCells } = computeLayout({ view: 'home' }, STAGES[0].stage, { viewportW: 1440, items: items() });
    expect(rail).toBeNull();
    expect(PLATE_ORDER.every(id => plates[id].mode === 'tile')).toBe(true);
    expect(plates.next.rect.h).toBe(STAGES[0].stage.h);
    expect(plates.events.rect.x).toBe(plates.artists.rect.x);
    expect(plates.signal.rect.x).toBe(plates.about.rect.x);
    expect(plates.signal.rect.y).toBeLessThan(plates.log.rect.y);
    expect(plates.next.rect.w).toBeGreaterThan(plates.events.rect.w);
    expect(homeCells.event).toBeGreaterThan(0);
    expect(homeCells.event).toBeLessThanOrEqual(3);
    expect(homeCells.artist).toBeLessThanOrEqual(8);
    const narrow = computeLayout({ view: 'home' }, STAGES[3].stage, { viewportW: 1024 });
    expect(narrow.plates.about.rect.w).toBeGreaterThanOrEqual(stageConfig.home.sideMinW);
  });

  it('keeps the rail in its fixed order with the open plate’s slot left empty, on either side', () => {
    for (const path of ['/events', '/transmit', '/events/TRM-02', '/artists/lucii']) {
      const layout = computeLayout(stageStateFromUrl(path), STAGES[0].stage, { viewportW: 1440 });
      const slots = PLATE_ORDER.map(id => layout.rail![id]);
      slots.forEach((slot, i) => i && expect(slot.y).toBeGreaterThan(slots[i - 1].y));
      for (const id of PLATE_ORDER) {
        const plate = layout.plates[id];
        if (plate.mode === 'rail') expect(plate.rect).toEqual(layout.rail![id]);
        else expect(layout.openSlots).toContain(id);
      }
    }
    expect(computeLayout(stageStateFromUrl('/events/TRM-02'), STAGES[0].stage).openSlots).toEqual(['events']);
    const right = computeLayout(stageStateFromUrl('/events'), STAGES[0].stage, { viewportW: 1440, config: { ...stageConfig, railSide: 'right' } });
    expect(right.rail!.next.x).toBeGreaterThan(right.plates.events.rect.x + right.plates.events.rect.w);
  });

  it('opens a detail under its parent strip, or in the parent’s place without one', () => {
    const layout = computeLayout(stageStateFromUrl('/events/TRM-02'), STAGES[0].stage, { viewportW: 1440, items: items() });
    expect(layout.items['event:TRM-02']).toMatchObject({ mode: 'detail', visible: true, rect: layout.detail });
    expect(layout.plates.events).toMatchObject({ mode: 'strip' });
    expect(layout.plates.events.rect.h).toBe(64);
    expect(layout.detail!.y).toBeGreaterThan(64);
    expect(EVENTS.filter(id => id !== 'TRM-02').every(id => !layout.items[`event:${id}`].visible)).toBe(true);
    const bare = computeLayout(stageStateFromUrl('/events/TRM-02'), STAGES[0].stage, { viewportW: 1440, config: { ...stageConfig, detailStrip: false } });
    expect(bare.plates.events.mode).toBe('rail');
    expect(bare.detail).toEqual(bare.focus);
  });

  it('pages the list by the rows that fit, never fewer than three, and parks other pages beside their slot', () => {
    const layout = computeLayout(stageStateFromUrl('/events', { page: '2' }), STAGES[0].stage, { viewportW: 1440, items: items(2) });
    const perPage = listRowsPerPage(layout.focus!.h, stageMetrics(1440));
    expect(layout.list).toMatchObject({ kind: 'event', perPage, page: 2, pages: Math.ceil(EVENTS.length / perPage) });
    expect(shownItems(layout).map(([key]) => key)).toEqual(EVENTS.slice(perPage, perPage * 2).map(id => `event:${id}`));
    const earlier = layout.items[`event:${EVENTS[0]}`];
    const same = layout.items[`event:${EVENTS[perPage]}`];
    expect(earlier.visible).toBe(false);
    expect(earlier.rect.y).toBe(same.rect.y - stageMetrics(1440).pageShift);
    expect(listRowsPerPage(300, stageMetrics(1440))).toBe(3);
    expect(computeLayout(stageStateFromUrl('/events', { page: '99' }), STAGES[0].stage, { items: items(99) }).list!.page).toBe(layout.list!.pages);
  });

  it('is deterministic for the same state and size', () => {
    const state = stageStateFromUrl('/artists/lucii');
    expect(computeLayout(state, STAGES[1].stage, { items: items() })).toEqual(computeLayout(state, STAGES[1].stage, { items: items() }));
  });

  it('reports a stage too small for its shown elements', () => {
    expect(computeLayout(stageStateFromUrl('/events'), { w: 1000, h: 200 }, { items: items() }).fits).toBe(false);
  });

  it('uses the same states in flow mode with the long-standing page sizes and no cells', () => {
    const list = computeFlowLayout(stageStateFromUrl('/events', { page: '2' }), { items: items(2) });
    expect(list.plates.events.mode).toBe('focus');
    expect(list.list).toMatchObject({ perPage: 4, page: 2, pages: 3 });
    expect(shownItems(list).map(([key]) => key)).toEqual(['event:TRM-05', 'event:TRM-04', 'event:TRM-03', 'event:TRM-02']);
    const home = computeFlowLayout({ view: 'home' }, { items: items() });
    expect(shownItems(home)).toHaveLength(0);
    expect(PLATE_ORDER.every(id => home.plates[id].mode === 'tile')).toBe(true);
    expect(computeFlowLayout(stageStateFromUrl('/artists/lucii'), { items: items() }).items['artist:lucii']).toMatchObject({ mode: 'detail', visible: true });
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

/** A fake measurer: every character is `px` wide (from the font size), words break at spaces. */
const fake: Measurer = {
  wrap(text, font, width) {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]);
    const lines: { text: string; width: number }[] = [];
    let line = '';
    for (const word of text.split(/(?<= )/)) {
      if (line && (line + word).trimEnd().length * px > width) {
        lines.push({ text: line, width: line.trimEnd().length * px });
        line = '';
      }
      line += word;
    }
    if (line) lines.push({ text: line, width: line.trimEnd().length * px });
    return lines;
  },
};

describe('text pages', () => {
  const frame = { font: '400 10px Barlow', lineHeight: 20, width: 100, height: 60, paragraphGap: 10 };
  const words = (count: number) => Array.from({ length: count }, (_, i) => `w${String(i).padStart(2, '0')}`).join(' ');

  it('fills pages line by line and splits a paragraph without losing or repeating text', () => {
    const paragraphs = [words(10), words(4)];
    const pages = paginate(paragraphs, frame, fake);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const lines = page.reduce((sum, chunk) => sum + fake.wrap(chunk.text, frame.font, frame.width).length, 0);
      expect(lines * frame.lineHeight + (page.length - 1) * frame.paragraphGap).toBeLessThanOrEqual(frame.height);
    }
    const rejoined = paragraphs.map((_, index) => pages.flat().filter(chunk => chunk.paragraph === index).map(chunk => chunk.text).join(' '));
    expect(rejoined).toEqual(paragraphs);
  });

  it('never strands one line of a paragraph at the foot of a page when two would fit elsewhere', () => {
    const pages = paginate([words(2), words(4)], { ...frame, height: 60 }, fake);
    // First paragraph takes one line; the gap leaves room for one more line only, so the second paragraph starts a page.
    expect(pages[0]).toHaveLength(1);
  });

  it('keeps everything on one page without a measurer, for empty text, or when lines do not add up', () => {
    expect(paginate(['a b'], frame, null)).toEqual([[{ paragraph: 0, text: 'a b' }]]);
    expect(paginate([], frame, fake)).toEqual([[]]);
    const liar: Measurer = { wrap: () => [{ text: 'other', width: 1 }] };
    expect(paginate(['a b'], frame, liar)).toEqual([[{ paragraph: 0, text: 'a b' }]]);
  });

  it('finds the largest title size that keeps to the line limit', () => {
    const title = { font: (px: number) => `800 ${px}px Barlow`, width: 100, maxLines: 1, minPx: 4, maxPx: 40 };
    expect(fitTitle('ten chars!', title, fake)).toBe(10);
    expect(fitTitle('ab', title, fake)).toBe(40);
    expect(fitTitle('ten chars!', { ...title, maxLines: 2 }, fake)).toBe(16); // 'chars!' alone must fit 100px
    expect(fitTitle('ten chars!', title, null)).toBe(40);
  });

  it('packs measured entries into pages of a height, in order', () => {
    expect(packHeights([40, 40, 40, 100], 90, 6)).toEqual([[0, 1], [2], [3]]);
    expect(packHeights([], 90, 6)).toEqual([]);
  });
});
