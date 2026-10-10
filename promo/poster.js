/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main|plates
 * &format=feed|story|a2 (&artist=<id>, &palette=<id>, &sample, &play). Every piece is also its motion:
 * a timeline that draws the poster from a bare ground, holds it and lets it go again. The still
 * poster is the timeline's held frame, so print and motion never drift apart.
 *
 * Every piece is set in the site's own grammar — plates of its roles on the field — with the flat
 * bearing dial on its one dark plate.
 *
 * `window.promo` lets the exporter drive it: `ready` (resolves once laid out), `seek(t)`, and the
 * timeline's `duration`, `hold` and `fps`.
 */
import { edition } from './data.js';
import { sampleArtists } from './pieces.js';

const params = new URLSearchParams(location.search);
const format = ['feed', 'story', 'a2', 'og'].includes(params.get('format')) ? params.get('format') : 'feed';
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
/* ── The graphic ────────────────────────────────────────────────────────────────────────────── */
/**
 * A compass and a signal, drawn flat. The compass is where we are: one small, complete instrument,
 * a ring cut with a tick every five degrees. Its needle swings from north to the bearing of the
 * signal and stays there — a direction found for the first time — and the one tick it points through
 * is marked in the accent. From the ring a course line runs out across the dark to the signal, a
 * disc in the accent with waves leaving it once every period (data.js `signal.period`). A few far
 * points keep the dark open.
 *
 * Spec, in fractions of the box (x of width, y of height, r of width):
 *   { compass: { x, y, r }, signal: { x, y }, at }
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

function drawCharts() {
  const painters = [];
  for (const { svg, spec } of charts) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const unit = width / 100;
    const centre = { x: spec.compass.x * width, y: spec.compass.y * height };
    const radius = spec.compass.r * width;
    const signal = { x: spec.signal.x * width, y: spec.signal.y * height };
    const bearing = (Math.atan2(signal.x - centre.x, centre.y - signal.y) * 180) / Math.PI;
    const toward = (degrees, distance, from = centre) => {
      const angle = (degrees * Math.PI) / 180;
      return { x: from.x + Math.sin(angle) * distance, y: from.y - Math.cos(angle) * distance };
    };
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const random = seeded(Number(edition.number) * 7919 + Math.round(bearing * 13));
    const stars = [];
    for (let i = 0; i < 70; i++) {
      const point = { x: random() * width, y: random() * height };
      const size = unit * (0.1 + random() ** 4 * 0.3);
      const alpha = 0.16 + random() ** 2 * 0.55;
      if (Math.hypot(point.x - centre.x, point.y - centre.y) < radius * 1.4) continue;
      if (Math.hypot(point.x - signal.x, point.y - signal.y) < unit * 4) continue;
      stars.push(s('circle', { class: 'star', cx: point.x, cy: point.y, r: size, opacity: alpha.toFixed(2) }));
    }

    const face = s('circle', { class: 'plane', cx: centre.x, cy: centre.y, r: radius });
    const ring = s('circle', { class: 'rim', cx: centre.x, cy: centre.y, r: radius, fill: 'none', 'stroke-width': unit * 0.14, pathLength: 1, transform: `rotate(-90 ${centre.x} ${centre.y})` });
    const inner = s('circle', { class: 'bezel', cx: centre.x, cy: centre.y, r: radius * 0.7, 'stroke-width': unit * 0.08 });
    const marked = Math.round(bearing / 5) * 5;
    const ticks = [];
    for (let degree = 0; degree < 360; degree += 5) {
      const cardinal = degree % 90 === 0;
      const length = radius * (cardinal ? 0.2 : degree % 45 === 0 ? 0.14 : 0.08);
      const outer = toward(degree, radius);
      const end = toward(degree, radius - length);
      ticks.push({ degree, node: s('line', { class: `tick${cardinal ? ' major' : ''}`, x1: outer.x, y1: outer.y, x2: end.x, y2: end.y, 'stroke-width': unit * (cardinal ? 0.2 : 0.11) }) });
    }
    // The bearing's own tick: cut through the ring in the accent, at the exact bearing.
    const markOut = toward(bearing, radius + unit * 1.4);
    const markIn = toward(bearing, radius - radius * 0.24);
    const mark = s('line', { class: 'tick marked', x1: markOut.x, y1: markOut.y, x2: markIn.x, y2: markIn.y, 'stroke-width': unit * 0.36 });
    // A compass needle: a narrow diamond, the half that points the way in the accent, the other quiet.
    const needle = s('polygon', { class: 'needle' });
    const tail = s('polygon', { class: 'tail' });
    const northTip = toward(0, radius + unit * 2.2);
    const northLeft = toward(-4, radius + unit * 0.8);
    const northRight = toward(4, radius + unit * 0.8);
    const north = s('polygon', { class: 'north', points: [northTip, northLeft, northRight].map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') });
    const pivot = s('circle', { class: 'fork', cx: centre.x, cy: centre.y, r: unit * 0.55 });
    const from = toward(bearing, radius + unit * 1.4);
    const gap = unit * 2.6;
    const span = Math.hypot(signal.x - from.x, signal.y - from.y);
    const to = { x: from.x + ((signal.x - from.x) * (span - gap)) / span, y: from.y + ((signal.y - from.y) * (span - gap)) / span };
    const course = s('line', { class: 'bearing', x1: from.x, y1: from.y, x2: to.x, y2: to.y, 'stroke-width': unit * 0.12, pathLength: 1 });
    const waveStep = unit * 3.4;
    const waveReach = waveStep * 9;
    const waves = Array.from({ length: 10 }, () => s('circle', { class: 'wave', cx: signal.x, cy: signal.y, r: 0, 'stroke-width': unit * 0.13 }));
    const disc = s('circle', { class: 'signal', cx: signal.x, cy: signal.y, r: 0 });
    svg.replaceChildren(...stars, ...waves, face, inner, ring, ...ticks.map(tick => tick.node), north, mark, course, tail, needle, pivot, disc);

    const t0 = spec.at ?? 1;
    const show = (node, progress) => {
      node.style.opacity = progress < 1 ? String(progress) : '';
    };
    painters.push(t => {
      stars.forEach((star, i) => show(star, easeEnter(clamp01((t - t0 - (i % 9) * 0.1) / 1.2))));
      show(face, easeEnter(clamp01((t - t0) / 0.9)));
      ring.setAttribute('stroke-dasharray', `${easeMove(clamp01((t - t0) / 1.2))} 1`);
      show(inner, easeEnter(clamp01((t - t0 - 0.6) / 0.8)));
      ticks.forEach(tick => show(tick.node, easeEnter(clamp01((t - t0 - 0.4 - (tick.degree / 360) * 1) / 0.3))));
      // The needle swings from north to the bearing and settles: the direction is found.
      const swing = easeMove(clamp01((t - t0 - 1.6) / 1.4));
      const angle = bearing * swing;
      const point = p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const tip = toward(angle, radius * 0.66);
      const back = toward(angle + 180, radius * 0.5);
      const left = toward(angle - 90, radius * 0.085);
      const right = toward(angle + 90, radius * 0.085);
      needle.setAttribute('points', [tip, left, right].map(point).join(' '));
      tail.setAttribute('points', [back, left, right].map(point).join(' '));
      show(needle, easeEnter(clamp01((t - t0 - 1.2) / 0.5)));
      show(tail, easeEnter(clamp01((t - t0 - 1.2) / 0.5)));
      show(pivot, easeEnter(clamp01((t - t0 - 1.2) / 0.5)));
      show(north, easeEnter(clamp01((t - t0 - 0.8) / 0.6)));
      needle.classList.toggle('lit', swing >= 1);
      show(mark, swing >= 1 ? easeEnter(clamp01((t - t0 - 3) / 0.4)) : 0);
      course.setAttribute('stroke-dasharray', `${easeMove(clamp01((t - t0 - 3.1) / 1))} 1`);
      disc.setAttribute('r', (unit * 1.7 * easeMove(clamp01((t - t0 - 3.9) / 0.6))).toFixed(2));
      const phase = (t / PULSE) % 1;
      const heard = easeEnter(clamp01((t - t0 - 4) / 1.4));
      waves.forEach((wave, i) => {
        const r = unit * 1.7 + (i + phase) * waveStep;
        wave.setAttribute('r', r.toFixed(2));
        wave.style.opacity = String(Math.max(0, 1 - r / waveReach) ** 1.5 * 0.8 * heard);
      });
    });
  }
  return t => {
    for (const paint of painters) paint(t);
  };
}

/* ── Pieces: every poster in the site's own grammar ─────────────────────────────────────────── */
/**
 * Few plates of the site's roles on the field, flush gaps: the wordmark and the session on a panel
 * plate, the compass and the signal on one dark plate that takes most of the sheet with the poster's
 * headline, the essentials on one row of paper plates, the lineup on an inset plate (the site's
 * empty-state well until it is out).
 */
const brandPlate = start =>
  cue(h('header', { class: 'brandPlate', 'data-surface': 'panel' }, wordmark(), sample && mono('Sample'), h('p', { class: 'sessionMark' }, `[${edition.number}]`)), start, 0.9, 'plate');
const heroPlate = (start, ...children) => cue(h('section', { class: 'heroPlate' }, ...children), start, 1.1, 'plate');
function infoRow(start, fields) {
  return h(
    'div',
    { class: 'infoRow' },
    fields.map(([label, value], i) =>
      cue(h('div', { class: label ? 'infoPlate' : 'infoPlate address', 'data-surface': 'paper' }, label && mono(label), label ? h('b', {}, value) : mono(value, 'strong')), start + i * 0.15, 0.9, 'plate'),
    ),
  );
}
const essentials = start => infoRow(start, [['Date', `${dateShort} ${weekday}`], ['Doors', `${edition.time} KST`], ['Venue', edition.venue], [null, edition.site]]);
const titleLines = (start, max, group = 'title') => balance(edition.title).map((line, i) => cue(fitLine(line, group, max), start + i * 0.25, 1.2, 'rise'));
function lineupPlate(start) {
  const inner = artists.length
    ? h('ul', { class: 'cells' }, artists.map(person => h('li', {}, fitLine(person.name, 'cell', 3.6), mono(`Dock ${person.dock}`))))
    : h('div', { class: 'well' }, h('b', {}, 'To be announced'), mono('TBA'));
  return cue(h('section', { class: 'lineupPlate', 'data-surface': 'inset' }, mono('Lineup', 'strong'), inner), start, 0.9, 'plate');
}
const plates = (...children) => h('div', { class: 'plates' }, ...children);

/** The teaser: the title and the date high in the dark, the compass below, the signal across. */
function teaser() {
  return {
    label: `TERMINAL Session ${edition.number} 티저`,
    tone: 'field',
    duration: pulses(8),
    nodes: [
      plates(
        brandPlate(0.3),
        heroPlate(
          0.6,
          chart({ compass: { x: 0.22, y: 0.77, r: 0.13 }, signal: { x: 0.78, y: 0.5 } }),
          h('div', { class: 'heroText atTop' }, h('p', { class: 'heroSub' }, cue(fitLine(edition.title, 'sub', 8.4), 5.2, 1.2, 'rise')), h('p', { class: 'heroDate' }, cue(fitLine(dateShort, 'date', 30), 5.5, 1.3, 'rise'))),
        ),
        infoRow(6, [['Doors', `${edition.time} KST`], ['Venue', edition.venue], [null, edition.site]]),
      ),
    ],
  };
}

/** One artist: the compass above the name, a different signal for each name. */
function artist() {
  const index = Math.max(0, artists.findIndex(item => item.id === params.get('artist')));
  const person = artists[index];
  const signals = [
    { x: 0.8, y: 0.4 },
    { x: 0.74, y: 0.16 },
    { x: 0.84, y: 0.28 },
    { x: 0.68, y: 0.36 },
  ];
  return {
    label: `TERMINAL Session ${edition.number} 아티스트 공개: ${person.name}`,
    tone: 'field',
    duration: pulses(7),
    nodes: [
      plates(
        brandPlate(0.3),
        heroPlate(
          0.6,
          chart({ compass: { x: 0.2, y: 0.22, r: 0.12 }, signal: signals[index % signals.length] }),
          h('div', { class: 'heroText' }, cue(mono(`Dock ${person.dock}`, 'strong'), 5.6, 1), h('h1', { class: 'name' }, balance(person.name).map((line, i) => cue(fitLine(line, 'name', 22), 5.2 + i * 0.25, 1.2, 'rise')))),
        ),
        essentials(5.8),
      ),
    ],
  };
}

/** The lineup: a short dark plate with the compass and the title, over the lineup's cells. */
function lineup() {
  return {
    label: `TERMINAL Session ${edition.number} 라인업 공개`,
    tone: 'field',
    duration: pulses(8),
    nodes: [
      plates(
        brandPlate(0.3),
        heroPlate(0.6, chart({ compass: { x: 0.84, y: 0.4, r: 0.1 }, signal: { x: 0.42, y: 0.18 } }), h('h1', { class: 'title' }, titleLines(5.2, 11))),
        lineupPlate(5.6),
        essentials(5.9),
      ),
    ],
  };
}

/** The main poster: the compass, the course and the signal over the title, then essentials and lineup. */
function main() {
  return {
    label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터`,
    tone: 'field',
    duration: pulses(9),
    nodes: [
      plates(
        brandPlate(0.3),
        heroPlate(0.6, chart({ compass: { x: 0.2, y: 0.36, r: 0.13 }, signal: { x: 0.8, y: 0.15 } }), h('h1', { class: 'title' }, titleLines(5.4, 15))),
        essentials(5.8),
        lineupPlate(6.2),
      ),
    ],
  };
}

/**
 * The site's link-preview image (format og, 1200 × 630): the brand on the dark plate with the dial,
 * and no edition facts, so it holds between sessions — `plates` keeps the wordmark on its own plate
 * above, `wordmark` sets it large in the dark. `edition` is the teaser laid out on the same canvas.
 */
function share() {
  const variant = params.get('variant');
  const label = 'TERMINAL 링크 미리보기';
  if (variant === 'edition') {
    return {
      label: `${label}: Session ${edition.number}`,
      tone: 'field',
      duration: pulses(6),
      nodes: [
        plates(
          brandPlate(0.3),
          heroPlate(
            0.6,
            chart({ compass: { x: 0.86, y: 0.58, r: 0.075 }, signal: { x: 0.6, y: 0.22 } }),
            h('div', { class: 'heroText atTop shareText' }, h('p', { class: 'heroSub' }, cue(fitLine(edition.title, 'sub', 5.6), 1.2, 1.2, 'rise')), h('p', { class: 'heroDate' }, cue(fitLine(dateShort, 'date', 15), 1.4, 1.3, 'rise'))),
          ),
          infoRow(1.6, [['Doors', `${edition.time} KST`], ['Venue', edition.venue], [null, edition.site]]),
        ),
      ],
    };
  }
  if (variant === 'wordmark') {
    return {
      label,
      tone: 'field',
      duration: pulses(6),
      nodes: [
        plates(
          heroPlate(
            0.3,
            chart({ compass: { x: 0.85, y: 0.6, r: 0.085 }, signal: { x: 0.56, y: 0.2 } }),
            h('div', { class: 'heroText shareText wide' }, h('p', { class: 'shareWord' }, cue(fitLine('TERMINAL', 'mark', 13), 1.2, 1.2, 'rise')), cue(mono(edition.site, 'strong'), 1.5, 1)),
          ),
        ),
      ],
    };
  }
  return {
    label,
    tone: 'field',
    duration: pulses(6),
    nodes: [
      plates(
        cue(h('header', { class: 'brandPlate', 'data-surface': 'panel' }, wordmark(), h('p', { class: 'shareSite' }, mono(edition.site, 'strong'))), 0.3, 0.9, 'plate'),
        heroPlate(0.6, chart({ compass: { x: 0.2, y: 0.52, r: 0.1 }, signal: { x: 0.74, y: 0.42 } })),
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
  const make = { teaser, artist, lineup, main, share }[params.get('piece')] ?? main;
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
  const paint = drawCharts();
  // Text that no longer fits the canvas (a long name, a long title) is reported, not silently cut.
  const layout = poster.querySelector('.plates');
  const bottom = poster.getBoundingClientRect().bottom;
  const overflow = [...layout.querySelectorAll(':not(svg, svg *)')].filter(element => element.getBoundingClientRect().bottom > bottom + 1 || element.scrollWidth > element.clientWidth + 1).map(element => element.className || element.localName);
  if (overflow.length) console.warn('promo: content overflows', overflow);

  const hold = exitAt - 0.05;
  const fading = [...poster.querySelectorAll('.plates')];
  const seek = t => {
    paint(t);
    for (const entry of cues) apply(entry, clamp01((t - entry.start) / entry.length));
    const exit = clamp01((t - exitAt) / EXIT.length);
    for (const element of fading) element.style.opacity = exit > 0 ? String(1 - easeExit(exit)) : '';
  };
  // Opened on its own in a window of another size, the canvas is scaled to fit and centred; at its
  // own size (the exporter, the contact sheet's frames) it is left exactly as laid out.
  const fitWindow = () => {
    const scale = Math.min(innerWidth / document.body.offsetWidth, innerHeight / document.body.offsetHeight);
    const exact = Math.abs(scale - 1) < 0.002;
    const x = (innerWidth - document.body.offsetWidth * scale) / 2;
    const y = (innerHeight - document.body.offsetHeight * scale) / 2;
    document.documentElement.style.setProperty('--fit', exact ? 'none' : `translate(${x}px, ${y}px) scale(${scale})`);
  };
  fitWindow();
  addEventListener('resize', fitWindow);
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
