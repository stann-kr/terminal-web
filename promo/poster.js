/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main&format=feed|story|a2
 * (&artist=<id>, &palette=<id>, &play). Every piece is also its motion: a timeline that builds the
 * poster plate by plate from an empty field, holds it and clears it again. The still poster is the
 * timeline's held frame, so print and motion never drift apart.
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
/** The last stretch of every timeline: the poster clears back to the field, so a loop starts clean. */
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
const dateLong = `${year}.${month}.${day} ${weekday}`;
const dateShort = `${month}.${day}`;
const session = `Session ${edition.number}`;
const docks = [...new Set(edition.artists.map(artist => artist.dock))];
const twoDigits = value => String(value).padStart(2, '0');

/* ── Building ───────────────────────────────────────────────────────────────────────────────── */
function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'surface') element.dataset.surface = value;
    else element.setAttribute(key, value === true ? '' : value);
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

const ringSpecs = new Map();
/** Concentric rings behind a plate's content, centred at `at` (fractions of the plate). */
function rings(at, { spacing = 1.8, stroke = 0.14, fade = [0.3, 0.72], ink } = {}) {
  const svg = s('svg', { class: 'rings', 'aria-hidden': 'true', ...(ink ? { style: `--ring-ink:${ink}%` } : {}) });
  ringSpecs.set(svg, { at, spacing, stroke, fade });
  return svg;
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

const chips = items => h('p', { class: 'chips' }, items.map(item => h('span', {}, item)));

function brandBar(...right) {
  return h('header', { class: 'plate bar', surface: 'panel' }, h('p', { class: 'wordmark' }, 'TERMINAL'), chips(right));
}

function fact(label, value, sub) {
  return h('div', { class: 'plate fact', surface: 'panel' }, h('p', { class: 'label' }, label), h('p', { class: 'value' }, value), sub && h('p', { class: 'sub' }, sub));
}

/** Date and venue, each on its own plate. */
function factsRow(at) {
  return h(
    'div',
    { class: 'row' },
    cue(fact('Date', dateLong, `${edition.time} KST`), at, 0.8, 'plate'),
    cue(fact('Venue', edition.venue, edition.district), at + 0.2, 0.8, 'plate'),
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
function teaser() {
  const hero = h(
    'section',
    { class: 'plate hero', surface: 'feature' },
    rings([1, 1], { spacing: 2.4, stroke: 0.16, fade: [0.2, 0.82], ink: 30 }),
    cue(h('div', { class: 'head' }, h('p', { class: 'label' }, 'Session'), chips([edition.code])), 1.4, 0.6),
    h(
      'div',
      { class: 'heroFoot' },
      cue(h('p', { class: 'number' }, fitLine(edition.number, 'number', 64)), 1.7, 1.1, 'rise'),
      cue(h('p', { class: 'title' }, fitLine(edition.title, 'title', 6.4)), 2.6, 0.8),
    ),
  );
  return {
    label: `TERMINAL ${session} 티저`,
    duration: 9.6,
    nodes: [cue(brandBar(edition.site), 0.3, 0.8, 'plate'), cue(hero, 0.6, 1.1, 'plate'), factsRow(3.2)],
  };
}

function artist() {
  const index = Math.max(0, edition.artists.findIndex(item => item.id === params.get('artist')));
  const person = edition.artists[index];
  // A series in the palette's plate roles, one per artist, as the site sets its plates apart by tone.
  const surface = ['feature', 'calm', 'mark', 'fresh', 'alert'][index % 5];
  const lines = balance(person.name);
  const hero = h(
    'section',
    { class: 'plate hero', surface },
    rings([0.5, 0.5], { spacing: 2, stroke: 0.14, fade: [0.18, 0.7], ink: 26 }),
    cue(h('div', { class: 'head' }, chips([`Dock ${person.dock}`, person.origin]), chips([edition.code])), 1.4, 0.6),
    h('p', { class: 'name' }, lines.map((line, at) => cue(fitLine(line, 'name', 26), 1.8 + at * 0.25, 1.1, 'rise'))),
    cue(chips([session, edition.title]), 2.8, 0.7),
  );
  return {
    label: `TERMINAL ${session} 아티스트 공개: ${person.name}`,
    duration: 7.2,
    nodes: [cue(brandBar(`Artist ${twoDigits(index + 1)} / ${twoDigits(edition.artists.length)}`), 0.3, 0.8, 'plate'), cue(hero, 0.6, 1.1, 'plate'), factsRow(3.2)],
  };
}

function lineup() {
  const roster = h(
    'ul',
    { class: 'roster' },
    edition.artists.map((person, at) =>
      cue(h('li', {}, h('b', {}, fitLine(person.name, 'roster', 12)), chips([`Dock ${person.dock}`, person.origin])), 1.8 + at * 0.32, 0.9, 'plate'),
    ),
  );
  const hero = h(
    'section',
    { class: 'plate hero', surface: 'paper' },
    rings([1, 0], { spacing: 1.8, stroke: 0.12, fade: [0.15, 0.6], ink: 16 }),
    cue(h('div', { class: 'head' }, h('p', { class: 'bandName' }, 'Lineup'), chips([session, `${edition.artists.length} Artists`])), 1.4, 0.6),
    roster,
  );
  const settled = 1.8 + edition.artists.length * 0.32 + 0.9;
  return {
    label: `TERMINAL ${session} 라인업 공개`,
    duration: Math.ceil((settled + 4.4) / RING_PERIOD) * RING_PERIOD,
    nodes: [cue(brandBar(edition.code, dateShort), 0.3, 0.8, 'plate'), cue(hero, 0.6, 1.1, 'plate'), factsRow(settled)],
  };
}

function main() {
  const hero = h(
    'section',
    { class: 'plate hero', surface: 'feature' },
    rings([1, 1], { spacing: 2, stroke: 0.14, fade: [0.2, 0.8], ink: 28 }),
    cue(h('div', { class: 'head' }, chips([session, edition.stage.en, edition.stage.ko]), chips([edition.code])), 1.2, 0.6),
    h('h1', { class: 'title' }, balance(edition.title).map((line, at) => cue(fitLine(line, 'title', 16), 1.5 + at * 0.25, 1.1, 'rise'))),
  );
  const lineupPlate = h(
    'section',
    { class: 'plate lineup', surface: 'inset' },
    h('div', { class: 'band' }, h('h2', { class: 'bandName' }, 'Lineup'), chips([`${docks.length} Docks`, `${edition.artists.length} Artists`])),
    h(
      'div',
      { class: 'docks' },
      docks.map((dock, row) =>
        h(
          'div',
          { class: 'dock' },
          h('p', { class: 'label' }, `Dock ${dock}`),
          h(
            'ul',
            { class: 'cells' },
            edition.artists
              .filter(person => person.dock === dock)
              .map((person, at) => cue(h('li', { class: 'cell' }, h('b', {}, fitLine(person.name, 'cell', 4.2)), h('small', {}, person.origin)), 3.4 + row * 0.3 + at * 0.12, 0.7, 'plate')),
          ),
        ),
      ),
    ),
  );
  return {
    label: `TERMINAL ${session}: ${edition.title} 메인 포스터`,
    duration: 12,
    nodes: [
      cue(brandBar(edition.code, 'Seoul'), 0.3, 0.8, 'plate'),
      cue(hero, 0.6, 1.1, 'plate'),
      factsRow(2.4),
      cue(lineupPlate, 3, 0.9, 'plate'),
      cue(h('footer', { class: 'foot' }, h('span', {}, edition.site), h('span', {}, edition.sound), h('span', {}, edition.coords)), 4.2, 0.8, 'plate'),
    ],
  };
}

/* ── Layout passes ──────────────────────────────────────────────────────────────────────────── */
async function fontsReady() {
  await Promise.all(
    ['400 100px ProcrastinatingPixie', '700 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', '600 100px "Barlow Condensed"'].map(font =>
      document.fonts.load(font).catch(() => null),
    ),
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

const ringSets = [];
/** Draws each ring set to its plate's measured size, faded out toward its edge as the site masks them. */
function drawRings() {
  const unit = document.body.clientWidth / 100;
  let id = 0;
  for (const [svg, { at, spacing, stroke, fade }] of ringSpecs) {
    const width = svg.parentElement.clientWidth;
    const height = svg.parentElement.clientHeight;
    const cx = at[0] * width;
    const cy = at[1] * height;
    const far = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const step = spacing * unit;
    const key = `rings-${++id}`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const circles = Array.from({ length: Math.ceil((far * fade[1]) / step) + 2 }, () => s('circle', { cx, cy, r: 0 }));
    svg.replaceChildren(
      s('radialGradient', { id: `${key}-fade`, gradientUnits: 'userSpaceOnUse', cx, cy, r: far }, s('stop', { offset: fade[0], 'stop-color': '#fff' }), s('stop', { offset: fade[1], 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: `${key}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, s('rect', { width, height, fill: `url(#${key}-fade)` })),
      s('g', { mask: `url(#${key}-mask)`, fill: 'none', stroke: 'currentColor', 'stroke-width': stroke * unit }, ...circles),
    );
    ringSets.push({ circles, step });
  }
}
function s(tag, attributes, ...children) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.append(...children);
  return element;
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
    style.clipPath = `inset(${(1 - eased) * 100}% 0 0 0)`;
    style.transform = `translateY(${(1 - eased) * 0.12}em)`;
  } else {
    const eased = easeEnter(progress);
    style.opacity = String(eased);
    style.transform = `translateY(${(1 - eased) * 0.8}cqw)`;
  }
}

function timeline(composition, poster) {
  const exitAt = composition.duration - EXIT.start;
  return {
    duration: composition.duration,
    hold: exitAt - 0.05,
    seek(t) {
      for (const { circles, step } of ringSets) {
        const phase = ((t / RING_PERIOD) % 1) * step;
        circles.forEach((circle, i) => circle.setAttribute('r', (i * step + phase).toFixed(2)));
      }
      for (const entry of cues) apply(entry, clamp01((t - entry.start) / entry.length));
      const exit = clamp01((t - exitAt) / EXIT.length);
      poster.style.opacity = exit > 0 ? String(1 - easeExit(exit)) : '';
    },
  };
}

async function start() {
  const make = { teaser, artist, lineup, main }[params.get('piece')] ?? main;
  const composition = make();
  const poster = document.querySelector('.poster');
  poster.append(...composition.nodes);
  poster.setAttribute('aria-label', composition.label);
  document.title = composition.label;
  await fontsReady();
  fit();
  drawRings();
  // A plate whose content no longer fits (a long name, a long title) is reported, not silently cut.
  // Boxes, not scroll size: tight display leading lets glyph metrics spill without anything being cut.
  const overflow = [...poster.querySelectorAll('.plate')]
    .filter(plate => {
      const edge = plate.getBoundingClientRect();
      return plate.scrollWidth > plate.clientWidth + 1 || [...plate.querySelectorAll(':scope > :not(svg), :scope > :not(svg) *')].some(child => child.getBoundingClientRect().bottom > edge.bottom + 1);
    })
    .map(plate => plate.className);
  if (overflow.length) console.warn('promo: content overflows', overflow);
  const { duration, hold, seek } = timeline(composition, poster);
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
