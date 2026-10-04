/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main|plates
 * &format=feed|story|a2 (&artist=<id>, &palette=<id>, &sample, &play). Every piece is also its motion:
 * a timeline that draws the poster from a bare ground, holds it and lets it go again. The still
 * poster is the timeline's held frame, so print and motion never drift apart.
 *
 * `main` sets the poster open on its ground; `plates` sets the same poster in the site's own grammar,
 * plates of the site's roles on the field. The graphic is the same flat bearing dial in both.
 *
 * `window.promo` lets the exporter drive it: `ready` (resolves once laid out), `seek(t)`, and the
 * timeline's `duration`, `hold` and `fps`.
 */
import { edition } from './data.js';
import { sampleArtists } from './pieces.js';

const params = new URLSearchParams(location.search);
const format = ['feed', 'story', 'a2'].includes(params.get('format')) ? params.get('format') : 'feed';
document.documentElement.dataset.format = format;
document.documentElement.dataset.palette = params.get('palette') || edition.palette;

/** The beat of the rings: the signal's period, else the site's ring period. */
const PULSE = edition.signal?.period ?? 2.4;
const pulses = count => count * PULSE;
/** The last stretch of every timeline: the poster goes back to the dark, so a loop starts clean. */
const EXIT = { start: 1.2, length: 0.9 };

/** Before the lineup is out, the artist and lineup pieces can be previewed with stand-in names. */
const sample = edition.artists.length === 0 && params.has('sample');
const artists = sample ? sampleArtists : edition.artists;

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
const docks = [...new Set(artists.map(artist => artist.dock))];

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
const top = start => h('header', { class: 'top' }, cue(wordmark(), start, 1.2), cue(h('p', { class: 'meta' }, mono(`Session ${edition.number}`, 'strong'), sample && mono('Sample')), start + 0.2, 1.2));

/** The essentials along the foot, under one hairline: date, doors, venue, the site. */
function info(start) {
  const field = (label, value) => h('div', { class: 'field' }, mono(label), h('b', {}, value));
  return cue(
    h('footer', { class: 'info' }, field('Date', `${dateShort} ${weekday}`), field('Doors', `${edition.time} KST`), field('Venue', edition.venue), h('div', { class: 'field end' }, mono(edition.site))),
    start,
    1.2,
  );
}

/* ── The graphic ────────────────────────────────────────────────────────────────────────────── */
/**
 * A bearing dial, drawn flat. Its centre is where we are, below the frame; its rim crosses the
 * poster like a horizon, cut with a tick every degree, longer every five and ten — steady, exact.
 * Inside the rim, one step lighter, is the known region we have come through. Beyond it, in the
 * dark, is the signal: a disc in the accent. The bearing to it is drawn from the centre, and the
 * one tick it crosses is marked in the accent too — a direction found for the first time. Once the
 * course is set the signal beats, a thin ring leaving it every period (data.js `signal.period`).
 *
 * Spec, in fractions of the box (x of width, y of height, lengths of width):
 *   { cx, cy, r, heading (degrees clockwise from up), reach (the signal's distance, in radii), at }
 */
const SVG = 'http://www.w3.org/2000/svg';
function s(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.append(...children);
  return element;
}

/** A small seeded generator, so the far points lie the same in every frame and every export. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const charts = [];
function chart(spec) {
  const svg = s('svg', { class: 'chart', 'aria-hidden': 'true' });
  charts.push({ svg, spec });
  return svg;
}

function drawCharts(quietAfter) {
  const painters = [];
  for (const { svg, spec } of charts) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const unit = width / 100;
    const centre = { x: spec.cx * width, y: spec.cy * height };
    const radius = spec.r * width;
    const toward = (degrees, distance) => {
      const angle = (degrees * Math.PI) / 180;
      return { x: centre.x + Math.sin(angle) * distance, y: centre.y - Math.cos(angle) * distance };
    };
    const inside = ({ x, y }, margin = 0) => x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const band = unit * 7;
    const plane = s('circle', { class: 'plane', cx: centre.x, cy: centre.y, r: radius });
    const inner = s('circle', { class: 'inner', cx: centre.x, cy: centre.y, r: radius - band });
    const bezel = s('circle', { class: 'bezel', cx: centre.x, cy: centre.y, r: radius - band, 'stroke-width': unit * 0.1 });
    // Beyond the rim, a few far points: the dark is open space, not a blank.
    const random = seeded(Number(edition.number) * 7919 + Math.round(spec.heading * 13));
    const stars = [];
    for (let i = 0; i < 90; i++) {
      const point = { x: random() * width, y: random() * height };
      const size = unit * (0.1 + random() ** 4 * 0.32);
      const alpha = 0.18 + random() ** 2 * 0.6;
      if (Math.hypot(point.x - centre.x, point.y - centre.y) < radius + unit * 3) continue;
      if (point.y < width * 0.16) continue; // the wordmark's band stays clear
      stars.push(s('circle', { class: 'star', cx: point.x, cy: point.y, r: size, opacity: alpha.toFixed(2) }));
    }
    const rim = s('circle', { class: 'rim', cx: centre.x, cy: centre.y, r: radius, 'stroke-width': unit * 0.16 });
    const heading = ((spec.heading % 360) + 360) % 360;
    const ticks = [];
    for (let degree = 0; degree < 360; degree++) {
      const major = degree % 10 === 0;
      const mid = degree % 5 === 0;
      const length = unit * (major ? 5.2 : mid ? 3.2 : 1.7);
      const outer = toward(degree, radius);
      const inner = toward(degree, radius - length);
      if (!inside(outer, unit * 4) && !inside(inner, unit * 4)) continue;
      const marked = degree === Math.round(heading);
      const node = s('line', {
        class: `tick${major ? ' major' : mid ? ' mid' : ''}${marked ? ' marked' : ''}`,
        x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y,
        'stroke-width': unit * (marked ? 0.5 : major ? 0.24 : 0.13),
      });
      ticks.push({ node, degree, marked });
    }
    // The marked tick runs a little past the rim, so the bearing reads as cut into the dial.
    const mark = ticks.find(tick => tick.marked);
    if (mark) {
      const out = toward(heading, radius + unit * 2.6);
      const deep = toward(heading, radius - band);
      Object.entries({ x1: out.x, y1: out.y, x2: deep.x, y2: deep.y }).forEach(([key, value]) => mark.node.setAttribute(key, value));
    }
    const signal = toward(heading, radius * (spec.reach ?? 1.16));
    const from = toward(heading, radius + unit * 2.6);
    const bearing = s('line', { class: 'bearing', x1: from.x, y1: from.y, x2: signal.x, y2: signal.y, 'stroke-width': unit * 0.12, pathLength: 1 });
    const pulse = s('circle', { class: 'pulse', cx: signal.x, cy: signal.y, r: 0, 'stroke-width': unit * 0.12 });
    const disc = s('circle', { class: 'signal', cx: signal.x, cy: signal.y, r: 0 });
    svg.replaceChildren(...stars, plane, inner, bezel, rim, ...ticks.map(tick => tick.node), bearing, pulse, disc);

    const t0 = spec.at ?? 0.3;
    const visible = ticks.map(tick => tick.degree > 180 ? tick.degree - 360 : tick.degree);
    const first = Math.min(...visible);
    const span = Math.max(...visible) - first || 1;
    const show = (node, progress) => {
      node.style.opacity = progress < 1 ? String(progress) : '';
    };
    painters.push(t => {
      const field = easeEnter(clamp01((t - t0) / 1.2));
      show(plane, field);
      show(inner, field);
      stars.forEach((star, i) => show(star, easeEnter(clamp01((t - t0 - (i % 9) * 0.12) / 1.2))));
      show(rim, easeEnter(clamp01((t - t0 - 0.3) / 1)));
      show(bezel, easeEnter(clamp01((t - t0 - 0.6) / 1)));
      // The ticks are cut in one sweep along the rim, left to right.
      ticks.forEach((tick, i) => show(tick.node, easeEnter(clamp01((t - t0 - 0.5 - ((visible[i] - first) / span) * 1.6) / 0.25))));
      bearing.setAttribute('stroke-dasharray', `${easeMove(clamp01((t - t0 - 2.6) / 0.9))} 1`);
      disc.setAttribute('r', (unit * 1.7 * easeMove(clamp01((t - t0 - 3.5) / 0.6))).toFixed(2));
      if (mark) mark.node.classList.toggle('lit', t >= t0 + 3.3);
      const phase = (t / PULSE) % 1;
      const beating = clamp01((t - t0 - 4) / 0.4) * clamp01((quietAfter - t) / 0.8);
      pulse.setAttribute('r', (unit * (1.7 + phase * 7)).toFixed(2));
      pulse.style.opacity = String((1 - phase) ** 1.8 * beating);
    });
  }
  return t => {
    for (const paint of painters) paint(t);
  };
}

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
/** The poster's essentials as plain type, for the open layout. */
const titleLines = (start, max, group = 'title') => balance(edition.title).map((line, i) => cue(fitLine(line, group, max), start + i * 0.25, 1.2, 'rise'));

/** The teaser: the chart and the date. */
function teaser() {
  return {
    label: `TERMINAL Session ${edition.number} 티저`,
    tone: 'night',
    duration: pulses(8),
    nodes: [
      chart({ cx: 0.5, cy: 1.02, r: 0.98, heading: 16, reach: 1.2 }),
      h(
        'div',
        { class: 'layout' },
        top(4.6),
        h('div', { class: 'spacer' }),
        h(
          'div',
          { class: 'teaserFoot' },
          cue(h('p', { class: 'teaserDate' }, fitLine(dateShort, 'date', 26)), 5, 1.4, 'rise'),
          cue(h('div', { class: 'teaserMeta' }, balance(edition.title).map(line => mono(line, 'strong')), mono(`${weekday} · ${edition.time} KST`), mono(edition.venue)), 5.6, 1.2),
        ),
      ),
    ],
  };
}

/** One artist: the destination moves with each name. */
function artist() {
  const index = Math.max(0, artists.findIndex(item => item.id === params.get('artist')));
  const person = artists[index];
  // Each name a different bearing from a different place: one series, never the same chart twice.
  const routes = [
    { cx: 0.3, cy: 1.06, heading: 28 },
    { cx: 0.74, cy: 1.08, heading: -26 },
    { cx: 0.22, cy: 1.1, heading: 36 },
    { cx: 0.8, cy: 1.05, heading: -34 },
  ];
  return {
    label: `TERMINAL Session ${edition.number} 아티스트 공개: ${person.name}`,
    tone: 'night',
    duration: pulses(6),
    nodes: [
      chart({ r: 1, reach: 1.14, ...routes[index % routes.length] }),
      h(
        'div',
        { class: 'layout' },
        top(4.2),
        h('div', { class: 'spacer' }),
        h('h1', { class: 'name' }, balance(person.name).map((line, i) => cue(fitLine(line, 'name', 24), 4.4 + i * 0.25, 1.2, 'rise'))),
        cue(h('p', { class: 'kicker' }, mono(`Dock ${person.dock}`, 'strong')), 5, 1),
        info(5.2),
      ),
    ],
  };
}

/** The lineup: a short chart over every name on its own rule. */
function lineup() {
  const settled = 4.4 + artists.length * 0.3 + 1;
  return {
    label: `TERMINAL Session ${edition.number} 라인업 공개`,
    tone: 'night',
    duration: Math.ceil((settled + 4.4) / PULSE) * PULSE,
    nodes: [
      chart({ cx: 0.12, cy: 0.62, r: 0.62, heading: 52, reach: 1.22 }),
      h(
        'div',
        { class: 'layout' },
        top(4),
        h('div', { class: 'spacer' }),
        cue(h('p', { class: 'rosterHead' }, mono('Lineup', 'strong')), 4.2, 1),
        h('ol', { class: 'roster' }, artists.map((person, i) => cue(h('li', {}, h('b', {}, fitLine(person.name, 'roster', 11)), mono(`Dock ${person.dock}`)), 4.4 + i * 0.3, 1, 'plate'))),
        info(settled),
      ),
    ],
  };
}

/** Lineup by dock once it is out; until then the poster says it is to be announced. */
function lineupBlock(start) {
  if (!artists.length) return cue(h('section', { class: 'tba' }, mono('Lineup', 'strong'), h('p', {}, 'To be announced')), start, 1.2);
  return cue(
    h(
      'section',
      { class: 'docks' },
      docks.map(dock =>
        h('div', { class: 'dock' }, h('p', { class: 'dockHead' }, mono(`Dock ${dock}`, 'strong')), h('ul', {}, artists.filter(person => person.dock === dock).map(person => h('li', {}, fitLine(person.name, 'lineup', 5.4))))),
      ),
    ),
    start,
    1.2,
  );
}

/** The main poster, open layout: the chart over the dark, the title, the lineup, the essentials. */
function main() {
  return {
    label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터`,
    tone: 'night',
    duration: pulses(9),
    nodes: [
      chart({ cx: 0.32, cy: 0.97, r: 1, heading: 30, reach: 1.14 }),
      h('div', { class: 'layout' }, top(4.4), h('div', { class: 'spacer' }), h('h1', { class: 'title' }, titleLines(4.6, 14)), lineupBlock(5.2), info(5.5)),
    ],
  };
}

/**
 * The main poster in the site's own grammar: plates of the site's roles on the field, flush gaps, the
 * chart and the title on one dark plate, the essentials on paper plates, the lineup on an inset plate
 * with the site's empty-state well, the address on a feature bar.
 */
function plates() {
  const infoPlate = (label, value, start) => cue(h('div', { class: 'infoPlate', 'data-surface': 'paper' }, mono(label), h('b', {}, value)), start, 0.9, 'plate');
  const lineupInner = artists.length
    ? h('ul', { class: 'cells' }, artists.map(person => h('li', {}, fitLine(person.name, 'cell', 3.6), mono(`Dock ${person.dock}`))))
    : h('div', { class: 'well' }, h('b', {}, 'To be announced'), mono('TBA'));
  return {
    label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터 (판)`,
    tone: 'field',
    duration: pulses(9),
    nodes: [
      h(
        'div',
        { class: 'plates' },
        cue(h('header', { class: 'brandPlate', 'data-surface': 'panel' }, wordmark(), mono(`Session ${edition.number}`)), 0.3, 0.9, 'plate'),
        cue(h('section', { class: 'heroPlate' }, chart({ cx: 0.32, cy: 1.14, r: 1, heading: 30, reach: 1.14, at: 1 }), h('h1', { class: 'title' }, titleLines(5, 12.2))), 0.6, 1.1, 'plate'),
        h('div', { class: 'infoRow' }, infoPlate('Date', `${dateShort} ${weekday}`, 5.4), infoPlate('Doors', `${edition.time} KST`, 5.55), infoPlate('Venue', edition.venue, 5.7)),
        cue(h('section', { class: 'lineupPlate', 'data-surface': 'inset' }, mono('Lineup', 'strong'), lineupInner), 5.9, 0.9, 'plate'),
        cue(h('footer', { class: 'footPlate', 'data-surface': 'feature' }, mono(edition.site, 'strong'), mono('Seoul', 'strong')), 6.1, 0.9, 'plate'),
      ),
    ],
  };
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
  const make = { teaser, artist, lineup, main, plates }[params.get('piece')] ?? main;
  const composition = make();
  const poster = document.querySelector('.poster');
  poster.dataset.tone = composition.tone;
  poster.append(...composition.nodes, h('div', { class: 'grain', 'aria-hidden': 'true' }));
  poster.setAttribute('aria-label', composition.label);
  document.title = composition.label;
  await fontsReady();
  fit();
  const { duration } = composition;
  const exitAt = duration - EXIT.start;
  // The signal falls quiet just before the held frame, so the still poster never catches a ring mid-flight.
  const paint = drawCharts(exitAt - 0.25);
  // Text that no longer fits the canvas (a long name, a long title) is reported, not silently cut.
  const layout = poster.querySelector('.layout, .plates');
  const bottom = poster.getBoundingClientRect().bottom;
  const overflow = [...layout.querySelectorAll(':not(svg, svg *)')].filter(element => element.getBoundingClientRect().bottom > bottom + 1 || element.scrollWidth > element.clientWidth + 1).map(element => element.className || element.localName);
  if (overflow.length) console.warn('promo: content overflows', overflow);

  const hold = exitAt - 0.05;
  const fading = [...poster.querySelectorAll('.chart, .layout, .plates')];
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
