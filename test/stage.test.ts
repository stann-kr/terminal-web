import { beforeEach, describe, expect, it } from 'vitest';
import { PLATE_ORDER, parseCarrierMark, resolveMissing, stageOrigin, stageParentHref, stageStateFromUrl, stateHref, stateKey, type StageState } from '../features/stage/state';
import { computeFlowLayout, computeLayout, listRowsPerPage, stageMetrics, tile, type LayoutInput, type Rect, type StageLayout } from '../features/stage/layout';
import { stageConfig } from '../features/stage/config';
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
    for (const path of ['/', '/events?page=2', '/events/A%20B/request', '/artists/x', '/transmit']) {
      const [pathname, search] = path.split('?');
      expect(stateHref(stageStateFromUrl(pathname, new URLSearchParams(search)))).toBe(path);
    }
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

// Stage sizes (window minus frame padding) for 1440×900, 1280×720, 1920×1080 and 1024×680.
const STAGES = [
  { viewportW: 1440, stage: { w: 1400, h: 880 } },
  { viewportW: 1280, stage: { w: 1244, h: 700 } },
  { viewportW: 1920, stage: { w: 1872, h: 1060 } },
  { viewportW: 1024, stage: { w: 995, h: 660 } },
];
const EVENTS = ['TRM-09', 'TRM-08', 'TRM-07', 'TRM-06', 'TRM-05', 'TRM-04', 'TRM-03', 'TRM-02', 'TRM-01'];
const ARTISTS = ['stann-lumo', 'lucii', 'marcus-l', 'nusnoom', 'a', 'b', 'c', 'd', 'e'];
const items = (eventPage = 1, artistPage = 1): LayoutInput['items'] => ({ event: { order: EVENTS, page: eventPage }, artist: { order: ARTISTS, page: artistPage } });
const PATHS = ['/', '/events', '/events/TRM-05', '/events/TRM-01/request', '/artists', '/artists/lucii', '/transmit', '/signal', '/about'];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: Rect, inner: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const shownItems = (layout: StageLayout) => Object.entries(layout.items).filter(([, item]) => item.visible);

describe('stage layout', () => {
  it('tiles every view with all six plates, apart, on one screen, carriers inside their plate or the detail', () => {
    for (const { viewportW, stage } of STAGES) {
      for (const path of PATHS) {
        const layout = computeLayout(stageStateFromUrl(path), stage, { viewportW, items: items() });
        const label = `${viewportW} ${path}`;
        expect(layout.fits, label).toBe(true);
        expect(layout.sheets, label).toEqual([{ y: 0, h: stage.h }]);
        const boxes = [...PLATE_ORDER.map(id => layout.plates[id].rect), ...(layout.detail ? [layout.detail] : []), ...(layout.back ? [layout.back] : [])];
        expect(PLATE_ORDER.every(id => layout.plates[id].mode !== 'hidden'), label).toBe(true);
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlaps(a, b), label).toBe(false)));
        boxes.forEach(box => expect(contains({ x: 0, y: 0, ...stage }, box), label).toBe(true));
        const shown = shownItems(layout);
        shown.forEach(([, a], i) => shown.slice(i + 1).forEach(([, b]) => expect(overlaps(a.rect, b.rect), label).toBe(false)));
        for (const [key, item] of shown) {
          const owner = key.startsWith('event:') ? layout.plates.events : layout.plates.artists;
          expect(contains(owner.rect, item.rect), `${label} ${key}`).toBe(true);
          expect(item.rel, `${label} ${key}`).toEqual({ x: item.rect.x - owner.rect.x, y: item.rect.y - owner.rect.y, w: item.rect.w, h: item.rect.h });
          if (layout.list && item.mode === 'row') expect(item.rect.y + item.rect.h, `${label} ${key}`).toBeLessThanOrEqual(layout.list.pager.y);
        }
      }
    }
  });

  it('gives every view its own arrangement and a way back everywhere but the home', () => {
    const stage = STAGES[0].stage;
    const signature = (path: string) => JSON.stringify(PLATE_ORDER.map(id => computeLayout(stageStateFromUrl(path), stage).plates[id]));
    const views = ['/', '/events', '/events/TRM-05', '/artists', '/artists/lucii', '/transmit', '/signal', '/about'];
    expect(new Set(views.map(signature)).size).toBe(views.length);
    expect(computeLayout({ view: 'home' }, stage).back).toBeNull();
    for (const path of views.slice(1)) expect(computeLayout(stageStateFromUrl(path), stage).back, path).not.toBeNull();
    const home = computeLayout({ view: 'home' }, stage);
    expect(home.plates.next.mode).toBe('hero');
    expect(home.plates.next.rect.h).toBe(stage.h);
  });

  it('opens a detail as a plate of its own beside an index that keeps the open line, marked current', () => {
    const layout = computeLayout(stageStateFromUrl('/events/TRM-05'), STAGES[0].stage, { viewportW: 1440, items: items() });
    expect(layout.plates.events.mode).toBe('index');
    expect(layout.open).toEqual({ kind: 'event', id: 'TRM-05' });
    expect(layout.detail).not.toBeNull();
    expect(overlaps(layout.detail!, layout.plates.events.rect)).toBe(false);
    expect(layout.items['event:TRM-05']).toMatchObject({ mode: 'index', visible: true, current: true });
    const lines = shownItems(layout).filter(([, item]) => item.mode === 'index').map(([key]) => key);
    expect(lines).toEqual(expect.arrayContaining(['event:TRM-06', 'event:TRM-05', 'event:TRM-04']));
    // Sub-plates are flush: each line starts where the one above ends, from edge to edge.
    const [first, second] = lines.map(key => layout.items[key].rect);
    expect(second.y).toBe(first.y + first.h);
    expect(first.w).toBe(layout.plates.events.rect.w);
  });

  it('starts carriers under the measured head of their plate', () => {
    const state = stageStateFromUrl('/events');
    const plain = computeLayout(state, STAGES[0].stage, { viewportW: 1440, items: items() });
    const measured = computeLayout(state, STAGES[0].stage, { viewportW: 1440, items: items(), heads: { events: 200 } });
    expect(measured.items['event:TRM-09'].rect.y).toBe(plain.plates.events.rect.y + 200);
    expect(measured.list!.perPage).toBeLessThanOrEqual(plain.list!.perPage);
  });

  it('fills plates with their sub-plates: no strip under a full page, short lists grow to twice at most, a half row widens', () => {
    const stage = STAGES[0].stage;
    const m = stageMetrics(1440);
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.01);
    // A full page: its last row ends on the pager.
    const full = computeLayout(stageStateFromUrl('/events'), stage, { viewportW: 1440, items: items() });
    const rows = shownItems(full).filter(([, item]) => item.mode === 'row').map(([, item]) => item.rect);
    close(rows.at(-1)!.y + rows.at(-1)!.h, full.list!.pager.y);
    // Two sessions on a page that fits more: taller rows, but not past twice their height.
    const few = computeLayout(stageStateFromUrl('/events'), stage, { viewportW: 1440, items: { event: { order: EVENTS.slice(0, 2) } } });
    const fewRows = shownItems(few).filter(([, item]) => item.mode === 'row').map(([, item]) => item.rect);
    expect(fewRows[0].h).toBeGreaterThan(m.rowH);
    expect(fewRows[0].h).toBeLessThanOrEqual(2 * m.rowH);
    expect(fewRows[1].y).toBe(fewRows[0].y + fewRows[0].h);
    // Three artists in a two-column summary: the third cell runs the plate's width.
    const home = computeLayout(stageStateFromUrl('/'), stage, { viewportW: 1440, items: { artist: { order: ARTISTS.slice(0, 3) } } });
    const cells = ARTISTS.slice(0, 3).map(id => home.items[`artist:${id}`].rect);
    close(cells[0].w * 2, home.plates.artists.rect.w);
    close(cells[2].w, home.plates.artists.rect.w);
  });

  it('pages the list by the rows that fit and parks other pages beside their slot', () => {
    const layout = computeLayout(stageStateFromUrl('/events', { page: '2' }), STAGES[1].stage, { viewportW: 1280, items: items(2) });
    const metrics = stageMetrics(1280);
    const perPage = listRowsPerPage(layout.plates.events.rect.h, metrics.head.hero, metrics);
    expect(layout.list).toMatchObject({ kind: 'event', perPage, page: 2, pages: Math.ceil(EVENTS.length / perPage) });
    expect(shownItems(layout).filter(([, item]) => item.mode === 'row').map(([key]) => key)).toEqual(EVENTS.slice(perPage, perPage * 2).map(id => `event:${id}`));
    const earlier = layout.items[`event:${EVENTS[0]}`];
    const same = layout.items[`event:${EVENTS[perPage]}`];
    expect(earlier.visible).toBe(false);
    expect(earlier.rect.y).toBe(same.rect.y - metrics.pageShift);
    const last = computeLayout(stageStateFromUrl('/events'), STAGES[0].stage, { items: items() }).list!.pages;
    expect(computeLayout(stageStateFromUrl('/events', { page: '99' }), STAGES[0].stage, { items: items(99) }).list!.page).toBe(last);
  });

  it('spreads a view over sheets instead of scrolling: the open plate first, spilled plates after, growing last', () => {
    const stage = STAGES[1].stage;
    const state = stageStateFromUrl('/transmit');
    const alone = computeLayout(state, stage, { spill: { alone: true, moved: [], grow: {} }, sheetGap: 20 });
    expect(alone.sheets).toEqual([{ y: 0, h: stage.h }, { y: stage.h + 20, h: stage.h }]);
    expect(alone.sheetOf).toMatchObject({ log: 0, back: 0, next: 1, events: 1, signal: 1 });
    expect(alone.plates.log.rect.w).toBe(stage.w);
    const moved = computeLayout(state, stage, { spill: { alone: false, moved: ['signal'], grow: {} }, sheetGap: 20 });
    expect(moved.sheetOf.signal).toBe(1);
    expect(moved.plates.signal.rect).toMatchObject({ y: stage.h + 20, h: stage.h, w: stage.w });
    const grown = computeLayout(state, stage, { spill: { alone: true, moved: [], grow: { log: 300 } }, sheetGap: 20 });
    expect(grown.sheets[0].h).toBe(stage.h + 300);
    expect(grown.sheets[1].y).toBe(stage.h + 300 + 20);
  });

  it('puts a narrow window’s columns on sheets of their own, the open plate first', () => {
    const narrow = { w: 370, h: 824 };
    const layout = computeLayout(stageStateFromUrl('/events'), narrow, { viewportW: 390, items: items() });
    expect(layout.sheets.length).toBeGreaterThan(1);
    expect(layout.sheetOf.events).toBe(0);
    expect(PLATE_ORDER.every(id => layout.plates[id].rect.w === narrow.w)).toBe(true);
    // Secondary sheets are as tall as their plates, not a whole window: chips stay chip-sized, and
    // the back card keeps its own height over the open plate.
    const m = stageMetrics(390);
    const chips = layout.sheets[layout.sheetOf.log!];
    expect(layout.sheetOf.signal).toBe(layout.sheetOf.log);
    expect(chips.h).toBeLessThan(narrow.h);
    expect(Math.round(layout.plates.log.rect.h)).toBe(m.natural.chip);
    // In a session the next-session chip keeps room for its wordmark bar over the session line.
    const session = computeLayout(stageStateFromUrl('/events/TRM-05'), narrow, { viewportW: 390, items: items() });
    expect(session.plates.next.mode).toBe('chip');
    expect(Math.round(session.plates.next.rect.h)).toBe(m.natural.nextChip);
    expect(Math.round(layout.back!.h)).toBe(m.natural.back);
    expect(layout.sheets[0].h).toBe(narrow.h);
  });

  it('keeps the back card at its height when a long file grows its sheet', () => {
    const state = stageStateFromUrl('/events/TRM-05');
    const m = stageMetrics(390);
    const narrow = { w: 370, h: 824 };
    const plain = computeLayout(state, narrow, { viewportW: 390, items: items() });
    const grown = computeLayout(state, narrow, { viewportW: 390, items: items(), spill: { alone: true, moved: [], grow: { detail: 1600 } } });
    expect(Math.round(plain.back!.h)).toBe(m.natural.back);
    expect(Math.round(grown.back!.h)).toBe(m.natural.back);
    expect(Math.round(grown.detail!.h - plain.detail!.h)).toBe(1600);
    // The same on a wide stage, where a spilled file has a sheet of its own under the back card.
    const wide = STAGES[0].stage;
    const alone = computeLayout(state, wide, { viewportW: 1440, items: items(), spill: { alone: true, moved: [], grow: {} } });
    const tall = computeLayout(state, wide, { viewportW: 1440, items: items(), spill: { alone: true, moved: [], grow: { detail: 900 } } });
    expect(Math.round(tall.back!.h)).toBe(Math.round(alone.back!.h));
  });

  it('sizes a narrow home’s summary plates by what they hold', () => {
    const narrow = { w: 370, h: 824 };
    const m = stageMetrics(390);
    const layout = computeLayout(stageStateFromUrl('/'), narrow, { viewportW: 390, items: { event: { order: EVENTS }, artist: { order: ARTISTS.slice(0, 3) } } });
    // Three artists in two columns: the head and two rows of cells, not a fixed tall plate.
    expect(Math.round(layout.plates.artists.rect.h)).toBe(m.head.panel + 2 * m.panelCellH);
    expect(Math.round(layout.plates.signal.rect.h)).toBe(m.natural.signal);
    expect(Math.round(layout.plates.log.rect.h)).toBe(m.natural.log);
  });

  it('is deterministic for the same inputs', () => {
    const state = stageStateFromUrl('/artists/lucii');
    expect(computeLayout(state, STAGES[1].stage, { items: items() })).toEqual(computeLayout(state, STAGES[1].stage, { items: items() }));
  });

  it('lays out the server’s first markup in document order with the long-standing page sizes', () => {
    const list = computeFlowLayout(stageStateFromUrl('/events', { page: '2' }), { items: items(2) });
    expect(list.plates.events.mode).toBe('hero');
    expect(list.list).toMatchObject({ perPage: 4, page: 2, pages: 3 });
    expect(shownItems(list).map(([key]) => key)).toEqual(['event:TRM-05', 'event:TRM-04', 'event:TRM-03', 'event:TRM-02']);
    expect(computeFlowLayout(stageStateFromUrl('/artists/lucii'), { items: items() }).open).toEqual({ kind: 'artist', id: 'lucii' });
  });

  it('keeps every configured view complete: six plates once each, a detail only on details', () => {
    for (const [view, tree] of Object.entries(stageConfig.layouts)) {
      const leaves = tile(tree, { x: 0, y: 0, w: 1000, h: 1000 }, 0).map(([leaf]) => ('plate' in leaf ? leaf.plate : leaf.slot));
      expect(leaves.filter(key => (PLATE_ORDER as readonly string[]).includes(key)).sort(), view).toEqual([...PLATE_ORDER].sort());
      expect(leaves.includes('detail'), view).toBe(view === 'session' || view === 'artist');
      expect(leaves.includes('back'), view).toBe(view !== 'home');
    }
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
