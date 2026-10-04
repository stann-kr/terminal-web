/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main&format=feed|story|a2
 * (&artist=<id>, &palette=<id>, &sample, &play). Every piece is also its motion: a timeline that draws
 * the poster from a bare ground, holds it and clears it again. The still poster is the timeline's held
 * frame, so print and motion never drift apart.
 *
 * The graphic tells the edition's story with the site's one motif. A pulsar — one bright point —
 * sends out rings at the signal's own period (data.js `signal.period`), so in motion the poster beats
 * once every pulse. The heliosphere of the last edition stays behind as a great disc off the edge,
 * its rings still. A bearing line runs from its boundary to the signal: the course change at the
 * junction. A pulse trace, one spike per period, scrolls with the same beat.
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

const SVG = 'http://www.w3.org/2000/svg';
/** The beat of every moving ring and of the trace: the signal's period, else the site's ring period. */
const PULSE = edition.signal?.period ?? 2.4;
const pulses = count => count * PULSE;
/** The last stretch of every timeline: the poster clears back to its ground, so a loop starts clean. */
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
      h('div', { class: 'stubCol' }, mono('Venue'), h('b', {}, edition.venue)),
      h('div', { class: 'stubCol' }, mono('Doors'), h('b', {}, `${edition.time} KST`)),
      h('div', { class: 'stubCol stubEnd' }, mono(edition.site)),
    ),
    start,
    0.9,
    'plate',
  );
}

/* ── The graphic ────────────────────────────────────────────────────────────────────────────── */
/**
 * Art specs, in fractions of the canvas (x of width, y of height, lengths of width):
 *   shell    { x, y, r, spacing, at }        the last edition's heliosphere: a disc, still rings, an edge
 *   pulsar   { x, y, spacing, stroke, opacity, fade, at }
 *            rings that leave the point once per pulse; `fade` [from, to] of the farthest corner
 *   bearing  { at }                          a line from the shell's boundary to the pulsar
 */
const arts = [];
function art(spec) {
  const svg = s('svg', { class: 'art', 'aria-hidden': 'true' });
  arts.push({ svg, spec });
  return svg;
}

/** A pulse trace: a flat line with one sharp spike per period, scrolling with the beat. */
const traces = [];
function trace(start) {
  const svg = s('svg', { class: 'trace', 'aria-hidden': 'true' });
  traces.push({ svg, start });
  return svg;
}

function drawArt() {
  const unit = document.body.clientWidth / 100;
  const width = document.body.clientWidth;
  const height = document.body.clientHeight;
  const far = (x, y) => Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
  const painters = [];
  arts.forEach(({ svg, spec }, index) => {
    const key = `art-${index}`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const defs = s('defs');
    const nodes = [defs];
    const p = spec.pulsar && { x: spec.pulsar.x * width, y: spec.pulsar.y * height };

    let shell = null;
    if (spec.shell) {
      const { x, y, r, spacing, at } = spec.shell;
      shell = { x: x * width, y: y * height, r: r * width, at };
      const disc = s('circle', { class: 'disc', cx: shell.x, cy: shell.y, r: shell.r });
      const clip = s('circle', { cx: shell.x, cy: shell.y, r: shell.r });
      defs.append(s('clipPath', { id: `${key}-shell` }, clip));
      const step = spacing * unit;
      const inner = s('g', { class: 'onAccent', fill: 'none', stroke: 'currentColor', 'stroke-width': 0.09 * unit, opacity: 0.4 }, ...Array.from({ length: Math.ceil(shell.r / step) }, (_, i) => s('circle', { cx: shell.x, cy: shell.y, r: (i + 1) * step })));
      const edge = s('circle', { cx: shell.x, cy: shell.y, r: shell.r, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.16 * unit, opacity: 0.7, pathLength: 1, transform: `rotate(-90 ${shell.x} ${shell.y})` });
      nodes.push(disc, s('g', { 'clip-path': `url(#${key}-shell)` }, inner), edge);
      painters.push(t => {
        const grown = shell.r * easeMove(clamp01((t - at) / 1.6));
        disc.setAttribute('r', grown.toFixed(2));
        clip.setAttribute('r', grown.toFixed(2));
        edge.setAttribute('stroke-dasharray', `${easeMove(clamp01((t - at - 0.3) / 1.8))} 1`);
      });
    }

    if (spec.pulsar) {
      const { spacing, stroke, opacity, fade, at } = spec.pulsar;
      const step = spacing * unit;
      const reach = far(p.x, p.y);
      defs.append(
        s('radialGradient', { id: `${key}-fade`, gradientUnits: 'userSpaceOnUse', cx: p.x, cy: p.y, r: reach }, s('stop', { offset: fade[0], 'stop-color': '#fff' }), s('stop', { offset: fade[1], 'stop-color': '#fff', 'stop-opacity': 0 })),
        s('mask', { id: `${key}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, s('rect', { width, height, fill: `url(#${key}-fade)` })),
      );
      const circles = Array.from({ length: Math.ceil((reach * fade[1]) / step) + 2 }, () => s('circle', { cx: p.x, cy: p.y, r: 0 }));
      const rings = s('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': stroke * unit, opacity }, ...circles);
      const core = s('circle', { class: 'core', cx: p.x, cy: p.y, r: 0 });
      const flash = s('circle', { cx: p.x, cy: p.y, r: 0, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.3 * unit });
      nodes.push(s('g', { mask: `url(#${key}-mask)` }, rings), flash, core);
      painters.push(t => {
        const phase = (t / PULSE) % 1;
        circles.forEach((circle, i) => circle.setAttribute('r', ((i + phase) * step).toFixed(2)));
        const shown = easeEnter(clamp01((t - at) / 1.4));
        rings.style.opacity = shown < 1 ? String(shown * opacity) : '';
        core.setAttribute('r', (0.85 * unit * easeMove(clamp01((t - at + 0.4) / 0.8))).toFixed(2));
        // Each pulse leaves the core as a bright ring that thins out over the first part of the period.
        const burst = clamp01(phase / 0.4);
        flash.setAttribute('r', (unit * (0.85 + burst * 3.2)).toFixed(2));
        flash.style.opacity = String(t < at ? 0 : (1 - burst) ** 2);
      });
    }

    if (spec.bearing && p) {
      const from = shell
        ? (() => {
            const angle = Math.atan2(p.y - shell.y, p.x - shell.x);
            return { x: shell.x + Math.cos(angle) * shell.r, y: shell.y + Math.sin(angle) * shell.r };
          })()
        : { x: spec.bearing.x * width, y: spec.bearing.y * height };
      const line = s('line', { x1: from.x, y1: from.y, x2: p.x, y2: p.y, stroke: 'currentColor', 'stroke-width': 0.14 * unit, pathLength: 1 });
      const node = s('circle', { cx: from.x, cy: from.y, r: 0.55 * unit, class: 'nodeDot' });
      nodes.push(line, node);
      painters.push(t => {
        const drawn = easeMove(clamp01((t - spec.bearing.at) / 1.6));
        line.setAttribute('stroke-dasharray', `${drawn} 1`);
        node.style.opacity = String(clamp01((t - spec.bearing.at) / 0.4));
      });
    }

    svg.replaceChildren(...nodes);
  });

  for (const { svg, start } of traces) {
    const w = svg.clientWidth;
    const hgt = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    const path = s('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.14 * unit, 'stroke-linejoin': 'round' });
    svg.replaceChildren(path);
    const period = 14 * unit;
    const mid = hgt * 0.72;
    // Low, fixed ripple on the line between pulses: quiet, never random, so every frame is repeatable.
    const ripple = x => Math.sin(x * 0.21) * 0.5 + Math.sin(x * 0.057 + 1.3) * 0.7;
    painters.push(t => {
      const offset = (t / PULSE) * period;
      const visible = easeMove(clamp01((t - start) / 1.4)) * w;
      let d = '';
      for (let x = 0; x <= visible; x += 0.5) {
        const local = (((x + offset) % period) + period) % period;
        const spike = Math.exp(-(((local - period * 0.5) / (period * 0.022)) ** 2));
        const y = mid - spike * hgt * 0.68 + ripple(x + offset) * (unit * 0.08);
        d += `${x ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      path.setAttribute('d', d);
    });
  }

  return t => {
    for (const paint of painters) paint(t);
  };
}

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
/** The teaser: one pulse in a quiet field, the date it was first heard and the date we answer. */
function teaser() {
  const graphic = art({
    shell: { x: -0.14, y: 0.9, r: 0.56, spacing: 0.85, at: 0.3 },
    pulsar: { x: 0.66, y: 0.32, spacing: 4.4, stroke: 0.12, opacity: 0.8, fade: [0, 0.64], at: 0.9 },
    bearing: { at: 1.6 },
  });
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.4, 0.8), cue(h('p', { class: 'meta' }, mono(`Session ${edition.number}`, 'strong')), 1.6, 0.8)),
    h('div', { class: 'spacer' }),
    h(
      'div',
      { class: 'teaserFoot' },
      cue(h('p', { class: 'teaserDate' }, fitLine(dateShort, 'date', 31)), 2.4, 1.1, 'rise'),
      cue(h('div', { class: 'teaserMeta' }, balance(edition.title).map(line => mono(line, 'strong')), mono(`${weekday} · ${edition.time} KST`), mono(edition.venue)), 3, 0.9),
    ),
  );
  return { label: `TERMINAL Session ${edition.number} 티저`, tone: 'night', duration: pulses(8), nodes: [graphic, layout] };
}

/** One artist: a poster per name, each in its own plate role with the signal somewhere else. */
function artist() {
  const index = Math.max(0, artists.findIndex(item => item.id === params.get('artist')));
  const person = artists[index];
  const tone = ['feature', 'calm', 'mark', 'fresh', 'alert'][index % 5];
  const spots = [
    { pulsar: { x: 0.7, y: 0.3 }, shell: { x: -0.18, y: 0.62 } },
    { pulsar: { x: 0.32, y: 0.28 }, shell: { x: 1.16, y: 0.6 } },
    { pulsar: { x: 0.68, y: 0.38 }, shell: { x: -0.16, y: 0.2 } },
    { pulsar: { x: 0.36, y: 0.34 }, shell: { x: 1.18, y: 0.24 } },
  ];
  const spot = spots[index % spots.length];
  const graphic = art({
    shell: { ...spot.shell, r: 0.42, spacing: 0.8, at: 0.3 },
    pulsar: { ...spot.pulsar, spacing: 4, stroke: 0.11, opacity: 0.7, fade: [0, 0.58], at: 0.8 },
    bearing: { at: 1.4 },
  });
  const layout = h(
    'div',
    { class: 'layout' },
    h(
      'header',
      { class: 'top' },
      cue(wordmark(), 1.4, 0.8),
      cue(h('p', { class: 'meta' }, mono(`Session ${edition.number}`, 'strong'), sample && mono('Sample')), 1.6, 0.8),
    ),
    h('div', { class: 'spacer' }),
    h('h1', { class: 'name' }, balance(person.name).map((line, i) => cue(fitLine(line, 'name', 30), 2.1 + i * 0.22, 1.1, 'rise'))),
    cue(h('p', { class: 'kicker' }, mono(`Dock ${person.dock}`, 'strong')), 2.8, 0.8),
    stub(3.2),
  );
  return { label: `TERMINAL Session ${edition.number} 아티스트 공개: ${person.name}`, tone, duration: pulses(6), nodes: [graphic, layout] };
}

/** The lineup: every name large on its own rule under the signal. */
function lineup() {
  const graphic = art({
    pulsar: { x: 0.8, y: 0.14, spacing: 4, stroke: 0.11, opacity: 0.7, fade: [0, 0.5], at: 0.5 },
  });
  const roster = h(
    'ol',
    { class: 'roster' },
    artists.map((person, i) => cue(h('li', {}, h('b', {}, fitLine(person.name, 'roster', 13)), mono(`Dock ${person.dock}`)), 1.8 + i * 0.28, 0.9, 'plate')),
  );
  const settled = 1.8 + artists.length * 0.28 + 0.9;
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.2, 0.8), sample && cue(h('p', { class: 'meta' }, mono('Sample', 'strong')), 1.4, 0.8)),
    h('div', { class: 'spacer' }),
    cue(h('p', { class: 'rosterHead' }, mono('Lineup', 'strong'), mono(`Session ${edition.number}`)), 1.5, 0.8),
    roster,
    stub(settled),
  );
  return { label: `TERMINAL Session ${edition.number} 라인업 공개`, tone: 'night', duration: Math.ceil((settled + 4.4) / PULSE) * PULSE, nodes: [graphic, layout] };
}

/** Lineup by dock once it is out; until then the main poster says it is to be announced. */
function lineupBlock(start) {
  if (!artists.length) {
    return cue(h('section', { class: 'tba' }, mono('Lineup', 'strong'), h('p', {}, 'To be announced')), start, 0.9, 'plate');
  }
  return cue(
    h(
      'section',
      { class: 'docks' },
      docks.map((dock, row) =>
        h(
          'div',
          { class: 'dock' },
          cue(h('p', { class: 'dockHead' }, mono(`Dock ${dock}`, 'strong')), start + 0.1 + row * 0.15, 0.6),
          h(
            'ul',
            {},
            artists.filter(person => person.dock === dock).map((person, i) => cue(h('li', {}, fitLine(person.name, 'lineup', 6.2)), start + 0.3 + row * 0.15 + i * 0.12, 0.8, 'plate')),
          ),
        ),
      ),
    ),
    start,
    1,
    'plate',
  );
}

/** The main poster: the signal over the title, the trace, the lineup, the stub. */
function main() {
  const graphic = art({
    shell: { x: -0.1, y: 0.02, r: 0.34, spacing: 0.85, at: 0.3 },
    pulsar: { x: 0.72, y: 0.25, spacing: 4.2, stroke: 0.12, opacity: 0.8, fade: [0, 0.6], at: 0.9 },
    bearing: { at: 1.6 },
  });
  const layout = h(
    'div',
    { class: 'layout' },
    h('header', { class: 'top' }, cue(wordmark(), 1.2, 0.8), cue(h('p', { class: 'meta' }, mono(`Session ${edition.number}`, 'strong')), 1.4, 0.8)),
    h('div', { class: 'spacer' }),
    h('h1', { class: 'title' }, balance(edition.title).map((line, i) => cue(fitLine(line, 'title', 17), 2 + i * 0.22, 1.1, 'rise'))),
    h('div', { class: 'traceRow' }, trace(3.3)),
    lineupBlock(3.9),
    stub(4.5),
  );
  return { label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터`, tone: 'night', duration: pulses(9), nodes: [graphic, layout] };
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
  const paint = drawArt();
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
