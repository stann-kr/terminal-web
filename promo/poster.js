/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main&format=feed|story|a2
 * (&artist=<id>, &palette=<id>, &play). Every piece is also its motion: a timeline that draws the
 * poster from a bare ground, holds it and clears it again. The still poster is the timeline's held
 * frame, so print and motion never drift apart.
 *
 * The graphic is the site's one motif grown into an event: a disc (the heliosphere) with dense rings
 * inside its edge, and sparser rings outside from two near centres whose interference sets up a slow
 * moiré. The rings flow outward at the site's own pace; the second centre drifts on a small orbit.
 *
 * `window.promo` lets the exporter drive it: `ready` (resolves once laid out), `seek(t)`, and the
 * timeline's `duration`, `hold` and `fps`.
 */
import { edition } from './data.js';

const params = new URLSearchParams(location.search);
const format = ['feed', 'story', 'a2'].includes(params.get('format')) ? params.get('format') : 'feed';
document.documentElement.dataset.format = format;
document.documentElement.dataset.palette = params.get('palette') || edition.palette;

const SVG = 'http://www.w3.org/2000/svg';
/** The site's ambient rings flow outward by one spacing every period (globals.css --ring-period). */
const RING_PERIOD = 2.4;
/** The last stretch of every timeline: the poster clears back to its ground, so a loop starts clean. */
const EXIT = { start: 1.2, length: 0.9 };

/* ── Easing: the site's stage curves (globals.css --ease-move, --ease) ──────────────────────── */
function bezier(x1, y1, x2, y2) {
  const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (curve(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return curve(y1, y2, (lo + hi) / 2);
  };
}
const easeMove = bezier(0.33, 0, 0.12, 1);
const easeEnter = bezier(0.2, 0.8, 0.2, 1);
const easeExit = bezier(0.4, 0, 1, 1);
const clamp01 = value => Math.min(1, Math.max(0, value));

/* ── Facts ──────────────────────────────────────────────────────────────────────────────────── */
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const [year, month, day] = edition.date.split('-');
const weekday = DAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
const dateShort = `${month}.${day}`;
const docks = [...new Set(edition.artists.map(artist => artist.dock))];
const twoDigits = value => String(value).padStart(2, '0');

/* ── Building ───────────────────────────────────────────────────────────────────────────────── */
function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    element.setAttribute(key, value === true ? '' : value);
  }
  element.append(...children.flat().filter(child => child != null && child !== false));
  return element;
}
function s(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.append(...children);
  return element;
}

/** Timeline entries: an element enters at `start` over `length` seconds, in one of a few ways. */
const cues = [];
function cue(element, start, length, kind = 'fade') {
  cues.push({ element, start, length, kind });
  return element;
}

/** A line set as large as its box allows, up to `max` (in hundredths of the canvas width). */
const fitLine = (text, group, max) => h('span', { class: 'fit', 'data-fit': group, 'data-max': max }, text);

/** Splits a name into at most two lines, cut where the longer line is shortest. */
function balance(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  let best = null;
  for (let cut = 1; cut < words.length; cut++) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const longest = Math.max(...lines.map(line => line.length));
    if (!best || longest < best.longest) best = { longest, lines };
  }
  return best.lines;
}

const mono = (text, extra = '') => h('span', { class: `mono ${extra}`.trim() }, text);
const wordmark = () => h('p', { class: 'wordmark' }, 'TERMINAL');

/**
 * The ticket stub: the one solid plate on the poster, in the site's way of setting a key along a
 * plate's foot. Date large, the rest small.
 */
function stub(start) {
  return cue(
    h(
      'footer',
      { class: 'stub' },
      h('p', { class: 'stubDate' }, dateShort, h('small', {}, `${weekday} ${year}`)),
      h('div', { class: 'stubCol' }, mono('Venue'), h('b', {}, edition.venue), mono(edition.district)),
      h('div', { class: 'stubCol' }, mono('Doors'), h('b', {}, `${edition.time} KST`), mono(edition.sound)),
      h('div', { class: 'stubCol stubEnd' }, mono(edition.code), mono(edition.site)),
    ),
    start,
    0.9,
    'plate',
  );
}

/* ── The graphic ────────────────────────────────────────────────────────────────────────────── */
/**
 * Art specs, in fractions of the canvas (x of width, y of height, sizes of width):
 *   disc  { x, y, r, at }                          a solid disc that grows in at `at`
 *   sets  [{ x, y, spacing, stroke, opacity, tone, disc: 'in'|'out', fade, drift, at }]
 *         rings from one centre; `disc` keeps them inside or outside the disc; `fade` [from, to]
 *         fades them out with distance; `drift` { r, turns } moves the centre round a small orbit.
 *   edge  { stroke, opacity, at }                  the disc's boundary drawn as one line
 */
const arts = [];
function art(spec) {
  const svg = s('svg', { class: 'art', 'aria-hidden': 'true' });
  arts.push({ svg, spec });
  return svg;
}

function drawArt(duration) {
  const unit = document.body.clientWidth / 100;
  const width = document.body.clientWidth;
  const height = document.body.clientHeight;
  const far = (x, y) => Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
  const scenes = [];
  arts.forEach(({ svg, spec }, index) => {
    const key = `art-${index}`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const defs = s('defs');
    const disc = spec.disc && { x: spec.disc.x * width, y: spec.disc.y * height, r: spec.disc.r * width, at: spec.disc.at };
    const discShape = disc && s('circle', { class: 'disc', cx: disc.x, cy: disc.y, r: disc.r });
    const clipIn = disc && s('circle', { cx: disc.x, cy: disc.y, r: disc.r });
    const holeOut = disc && s('circle', { cx: disc.x, cy: disc.y, r: disc.r, fill: '#000' });
    if (disc) defs.append(s('clipPath', { id: `${key}-in` }, clipIn));
    const layers = [];
    const sets = (spec.sets ?? []).map((set, i) => {
      const cx = set.x * width;
      const cy = set.y * height;
      const step = set.spacing * unit;
      const reach = set.disc === 'in' && disc ? disc.r + Math.hypot(cx - disc.x, cy - disc.y) : far(cx, cy);
      const circles = Array.from({ length: Math.ceil(reach / step) + 3 }, () => s('circle', { cx, cy, r: 0 }));
      const group = s('g', { class: `rings ${set.tone ?? ''}`.trim(), fill: 'none', stroke: 'currentColor', 'stroke-width': set.stroke * unit, opacity: set.opacity }, ...circles);
      let holder = group;
      if (set.disc === 'in' && disc) holder = s('g', { 'clip-path': `url(#${key}-in)` }, group);
      if (set.fade || set.disc === 'out') {
        const id = `${key}-m${i}`;
        const fill = set.fade ? `url(#${id}-g)` : '#fff';
        if (set.fade) {
          defs.append(s('radialGradient', { id: `${id}-g`, gradientUnits: 'userSpaceOnUse', cx, cy, r: far(cx, cy) }, s('stop', { offset: set.fade[0], 'stop-color': '#fff' }), s('stop', { offset: set.fade[1], 'stop-color': '#fff', 'stop-opacity': 0 })));
        }
        const mask = s('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, s('rect', { width, height, fill }));
        if (set.disc === 'out' && disc) mask.append(holeOut.cloneNode());
        defs.append(mask);
        holder = s('g', { mask: `url(#${id})` }, holder);
      }
      layers.push(holder);
      return { circles, group, cx, cy, step, drift: set.drift, at: set.at ?? 0.4 };
    });
    const edge = disc && spec.edge && s('circle', { class: `edge ${spec.edge.tone ?? ''}`.trim(), cx: disc.x, cy: disc.y, r: disc.r, fill: 'none', stroke: 'currentColor', 'stroke-width': spec.edge.stroke * unit, opacity: spec.edge.opacity, pathLength: 1, transform: `rotate(-90 ${disc.x} ${disc.y})` });
    svg.replaceChildren(defs, ...(discShape ? [discShape] : []), ...layers, ...(edge ? [edge] : []));
    // Masked holes follow the disc as it grows, so each mask keeps its own copy to update.
    const holes = [...defs.querySelectorAll('mask > circle')];
    scenes.push({ disc, discShape, clipIn, holes, edge, edgeAt: spec.edge?.at ?? 1, sets, unit });
  });
  return t => {
    for (const { disc, discShape, clipIn, holes, edge, edgeAt, sets, unit: u } of scenes) {
      if (disc) {
        const r = disc.r * easeMove(clamp01((t - disc.at) / 1.4));
        for (const circle of [discShape, clipIn, ...holes]) circle.setAttribute('r', r.toFixed(2));
      }
      if (edge) {
        const drawn = easeMove(clamp01((t - edgeAt) / 1.8));
        edge.setAttribute('stroke-dasharray', `${drawn} 1`);
      }
      for (const set of sets) {
        const phase = ((t / RING_PERIOD) % 1) * set.step;
        const angle = set.drift ? (t / duration) * Math.PI * 2 * set.drift.turns : 0;
        const cx = set.cx + (set.drift ? Math.cos(angle) * set.drift.r * 100 * u : 0);
        const cy = set.cy + (set.drift ? Math.sin(angle) * set.drift.r * 100 * u : 0);
        set.circles.forEach((circle, i) => {
          circle.setAttribute('cx', cx.toFixed(2));
          circle.setAttribute('cy', cy.toFixed(2));
          circle.setAttribute('r', (i * set.step + phase).toFixed(2));
        });
        const shown = easeEnter(clamp01((t - set.at) / 1.6));
        set.group.style.opacity = shown < 1 ? String(shown * Number(set.group.getAttribute('opacity'))) : '';
      }
    }
  };
}

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
/** The teaser: an eclipse on bare ceramic. Almost nothing written; the date carries it. */
function teaser() {
  const graphic = art({
    disc: { x: 0.5, y: 0.43, r: 0.36, at: 0.3 },
    sets: [
      { x: 0.5, y: 0.43, spacing: 0.95, stroke: 0.1, opacity: 0.5, tone: 'onAccent', disc: 'in', at: 1 },
      { x: 0.5, y: 0.43, spacing: 1.9, stroke: 0.11, opacity: 0.55, disc: 'out', fade: [0.2, 0.78], at: 0.6 },
      { x: 0.53, y: 0.46, spacing: 1.9, stroke: 0.11, opacity: 0.4, disc: 'out', fade: [0.15, 0.62], drift: { r: 0.02, turns: 1 }, at: 1.2 },
    ],
    edge: { stroke: 0.22, opacity: 1, at: 0.8 },
  });
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.4, 0.8), cue(h('p', { class: 'meta' }, mono(edition.code), mono(edition.site)), 1.6, 0.8)),
    h('div', { class: 'spacer' }),
    h(
      'div',
      { class: 'teaserFoot' },
      cue(h('p', { class: 'teaserDate' }, fitLine(dateShort, 'date', 31)), 2.2, 1.1, 'rise'),
      cue(h('div', { class: 'teaserMeta' }, mono(`Session ${edition.number}`, 'strong'), balance(edition.title).map(line => mono(line)), mono(`${weekday} · ${edition.time} KST`), mono(edition.venue)), 2.8, 0.9),
    ),
  );
  return { label: `TERMINAL Session ${edition.number} 티저`, tone: 'ceramic', duration: 9.6, nodes: [graphic, layout] };
}

/** One artist: a poster per name, each in its own plate role with the disc set somewhere else. */
function artist() {
  const index = Math.max(0, edition.artists.findIndex(item => item.id === params.get('artist')));
  const person = edition.artists[index];
  const tone = ['feature', 'calm', 'mark', 'fresh', 'alert'][index % 5];
  const spots = [
    { x: 0.7, y: 0.32 },
    { x: 0.3, y: 0.3 },
    { x: 0.66, y: 0.4 },
    { x: 0.34, y: 0.38 },
    { x: 0.62, y: 0.28 },
  ];
  const at = spots[index % spots.length];
  const graphic = art({
    disc: { ...at, r: 0.27, at: 0.3 },
    sets: [
      { ...at, spacing: 0.85, stroke: 0.09, opacity: 0.45, tone: 'onAccent', disc: 'in', at: 1 },
      { ...at, spacing: 1.7, stroke: 0.1, opacity: 0.5, disc: 'out', fade: [0.12, 0.7], at: 0.6 },
      { x: at.x + 0.035, y: at.y + 0.03, spacing: 1.7, stroke: 0.1, opacity: 0.35, disc: 'out', fade: [0.1, 0.55], drift: { r: 0.018, turns: 1 }, at: 1.2 },
    ],
    edge: { stroke: 0.2, opacity: 1, tone: 'onGround', at: 0.8 },
  });
  const lines = balance(person.name);
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.4, 0.8), cue(h('p', { class: 'meta' }, mono(`Artist ${twoDigits(index + 1)} / ${twoDigits(edition.artists.length)}`, 'strong'), mono(edition.code)), 1.6, 0.8)),
    h('div', { class: 'spacer' }),
    h('h1', { class: 'name' }, lines.map((line, i) => cue(fitLine(line, 'name', 30), 2.1 + i * 0.22, 1.1, 'rise'))),
    cue(h('p', { class: 'kicker' }, mono(`Dock ${person.dock}`, 'strong'), mono(person.origin), mono(`Session ${edition.number} · ${edition.title}`)), 2.8, 0.8),
    stub(3.2),
  );
  return { label: `TERMINAL Session ${edition.number} 아티스트 공개: ${person.name}`, tone, duration: 7.2, nodes: [graphic, layout] };
}

/** The lineup: every name large on its own rule, the disc rising off the top edge. */
function lineup() {
  const graphic = art({
    disc: { x: 0.82, y: 0.06, r: 0.3, at: 0.3 },
    sets: [
      { x: 0.82, y: 0.06, spacing: 0.9, stroke: 0.09, opacity: 0.45, tone: 'onAccent', disc: 'in', at: 1 },
      { x: 0.82, y: 0.06, spacing: 1.8, stroke: 0.1, opacity: 0.4, disc: 'out', fade: [0.1, 0.62], at: 0.6 },
      { x: 0.86, y: 0.09, spacing: 1.8, stroke: 0.1, opacity: 0.28, disc: 'out', fade: [0.08, 0.5], drift: { r: 0.02, turns: 1 }, at: 1.2 },
    ],
    edge: { stroke: 0.2, opacity: 1, tone: 'onGround', at: 0.8 },
  });
  const roster = h(
    'ol',
    { class: 'roster' },
    edition.artists.map((person, i) =>
      cue(h('li', {}, mono(twoDigits(i + 1)), h('b', {}, fitLine(person.name, 'roster', 13)), mono(`Dock ${person.dock}`)), 1.8 + i * 0.28, 0.9, 'plate'),
    ),
  );
  const settled = 1.8 + edition.artists.length * 0.28 + 0.9;
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.2, 0.8)),
    h('div', { class: 'spacer' }),
    cue(h('p', { class: 'rosterHead' }, mono('Lineup', 'strong'), mono(`Session ${edition.number} · ${edition.artists.length} Artists`)), 1.5, 0.8),
    roster,
    stub(settled),
  );
  return {
    label: `TERMINAL Session ${edition.number} 라인업 공개`,
    tone: 'night',
    duration: Math.ceil((settled + 4.4) / RING_PERIOD) * RING_PERIOD,
    nodes: [graphic, layout],
  };
}

/** The main poster: the heliosphere over the title, the lineup by dock, the stub. */
function main() {
  const graphic = art({
    disc: { x: 0.66, y: 0.3, r: 0.31, at: 0.3 },
    sets: [
      { x: 0.66, y: 0.3, spacing: 0.9, stroke: 0.09, opacity: 0.5, tone: 'onAccent', disc: 'in', at: 1 },
      { x: 0.66, y: 0.3, spacing: 1.8, stroke: 0.1, opacity: 0.42, disc: 'out', fade: [0.12, 0.66], at: 0.6 },
      { x: 0.7, y: 0.33, spacing: 1.8, stroke: 0.1, opacity: 0.3, disc: 'out', fade: [0.1, 0.52], drift: { r: 0.02, turns: 1 }, at: 1.2 },
    ],
    edge: { stroke: 0.2, opacity: 1, tone: 'onGround', at: 0.8 },
  });
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.2, 0.8), cue(h('p', { class: 'meta' }, mono(`Session ${edition.number}`, 'strong'), mono(edition.code)), 1.4, 0.8)),
    h('div', { class: 'spacer' }),
    h('h1', { class: 'title' }, balance(edition.title).map((line, i) => cue(fitLine(line, 'title', 17), 2 + i * 0.22, 1.1, 'rise'))),
    cue(h('p', { class: 'kicker' }, mono(edition.stage.en, 'strong'), mono(edition.stage.ko), mono(edition.coords)), 2.6, 0.8),
    cue(
      h(
        'section',
        { class: 'docks' },
        docks.map((dock, row) =>
          h(
            'div',
            { class: 'dock' },
            cue(h('p', { class: 'dockHead' }, mono(`Dock ${dock}`, 'strong')), 3 + row * 0.15, 0.6),
            h(
              'ul',
              {},
              edition.artists.filter(person => person.dock === dock).map((person, i) => cue(h('li', {}, fitLine(person.name, 'lineup', 6.2)), 3.2 + row * 0.15 + i * 0.12, 0.8, 'plate')),
            ),
          ),
        ),
      ),
      2.9,
      1,
      'plate',
    ),
    stub(4.2),
  );
  return { label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터`, tone: 'night', duration: 12, nodes: [graphic, layout] };
}

/* ── Layout passes ──────────────────────────────────────────────────────────────────────────── */
async function fontsReady() {
  await Promise.all(
    ['400 100px ProcrastinatingPixie', '700 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', '400 100px "Share Tech Mono"'].map(font => document.fonts.load(font).catch(() => null)),
  );
  await document.fonts.ready;
}

/** The largest size (px) at which the line fits its box, up to `max`. */
function largestFit(element, max) {
  element.style.fontSize = `${max}px`;
  if (element.scrollWidth <= element.clientWidth) return max;
  let lo = 4;
  let hi = max;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    element.style.fontSize = `${mid}px`;
    if (element.scrollWidth <= element.clientWidth) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Fits every line; lines of one group share the smallest of their sizes, so a stack reads as one block. */
function fit() {
  const unit = document.body.clientWidth / 100;
  const lines = [...document.querySelectorAll('[data-fit]')];
  const sizes = new Map();
  for (const line of lines) {
    const size = largestFit(line, Number(line.dataset.max) * unit);
    sizes.set(line.dataset.fit, Math.min(sizes.get(line.dataset.fit) ?? Infinity, size));
  }
  for (const line of lines) line.style.fontSize = `${sizes.get(line.dataset.fit)}px`;
}

/* ── Timeline ───────────────────────────────────────────────────────────────────────────────── */
function apply({ element, kind }, progress) {
  const { style } = element;
  if (progress >= 1) {
    style.clipPath = style.opacity = style.transform = '';
    return;
  }
  if (kind === 'plate') {
    style.clipPath = `inset(0 ${(1 - easeMove(progress)) * 100}% 0 0)`;
  } else if (kind === 'rise') {
    const eased = easeMove(progress);
    // The clip reaches a little below the box so descending glyphs are not cut, and starts that much higher.
    style.clipPath = `inset(calc(${1 - eased} * (100% + 0.25em)) 0 -0.25em 0)`;
    style.transform = `translateY(${(1 - eased) * 0.14}em)`;
  } else {
    const eased = easeEnter(progress);
    style.opacity = String(eased);
    style.transform = `translateY(${(1 - eased) * 0.8}cqw)`;
  }
}

async function start() {
  const make = { teaser, artist, lineup, main }[params.get('piece')] ?? main;
  const composition = make();
  const poster = document.querySelector('.poster');
  poster.dataset.tone = composition.tone;
  poster.append(...composition.nodes, h('div', { class: 'grain', 'aria-hidden': 'true' }));
  poster.setAttribute('aria-label', composition.label);
  document.title = composition.label;
  await fontsReady();
  fit();
  const { duration } = composition;
  const paint = drawArt(duration);
  // Text that no longer fits the canvas (a long name, a long title) is reported, not silently cut.
  const layout = poster.querySelector('.layout');
  const bottom = poster.getBoundingClientRect().bottom;
  const overflow = [...layout.querySelectorAll('*')].filter(element => element.getBoundingClientRect().bottom > bottom + 1 || element.scrollWidth > element.clientWidth + 1).map(element => element.className || element.localName);
  if (overflow.length) console.warn('promo: content overflows', overflow);

  const exitAt = duration - EXIT.start;
  const hold = exitAt - 0.05;
  const fading = [...poster.querySelectorAll('.art, .layout')];
  const seek = t => {
    paint(t);
    for (const entry of cues) apply(entry, clamp01((t - entry.start) / entry.length));
    const exit = clamp01((t - exitAt) / EXIT.length);
    for (const element of fading) element.style.opacity = exit > 0 ? String(1 - easeExit(exit)) : '';
  };
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (params.has('play') && !quiet) {
    const origin = performance.now();
    const tick = now => {
      seek(((now - origin) / 1000) % duration);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else {
    seek(hold);
  }
  return { duration, hold, fps: 30, seek, label: composition.label, overflow };
}

const ready = start();
window.promo = {
  ready: ready.then(({ duration, hold, fps, label, overflow }) => ({ duration, hold, fps, label, overflow })),
  seek: t => ready.then(({ seek }) => seek(t)),
};
