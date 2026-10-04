/**
 * One promo composition on one canvas: poster.html?piece=teaser|artist|lineup|main&format=feed|story|a2
 * (&artist=<id>, &palette=<id>, &sample, &play). Every piece is also its motion: a timeline that draws
 * the poster out of the dark, holds it and lets it go again. The still poster is the timeline's held
 * frame, so print and motion never drift apart.
 *
 * The edition's story, in light rather than in shapes: there are no coordinates left to return to,
 * only the dark, and in it one signal, far off, steady, exact. It is painted on a canvas — a deep
 * ground that sinks toward its edges with a little dust in it, and a soft point that sends out rings
 * of light once every period of the signal (data.js `signal.period`), each ring fading as it travels.
 * A faint course line rises from below the frame, where we are, toward the signal: a direction found
 * for the first time.
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
 * Art specs, in fractions of the canvas (x of width, y of height, lengths of width):
 *   signal  { x, y }          where the signal is
 *   spacing                   the distance between rings, i.e. how far light goes in one period
 *   reach                     how far the rings carry before they are gone
 *   tint                      a plate role whose colour warms the light (an artist's own), or none
 *   course  { x, y, at }      the point below the frame the course line rises from, and when
 *   at                        when the signal is first picked up
 */
const arts = [];
function art(spec) {
  const ground = h('canvas', { class: 'ground', 'aria-hidden': 'true' });
  const light = h('canvas', { class: 'art', 'aria-hidden': 'true' });
  arts.push({ ground, light, spec });
  return [ground, light];
}

/** The poster's own colours, read from the palette through the tone's tokens. */
function colour(token) {
  const probe = h('i', { style: `color: var(${token}); display: none` });
  document.querySelector('.poster').append(probe);
  const [r, g, b] = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
  probe.remove();
  return [r, g, b];
}
const mix = (a, b, share) => a.map((value, i) => Math.round(value * share + b[i] * (1 - share)));
const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${alpha})`;

/** A small seeded generator, so the dust lies the same in every frame and every export. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawArt() {
  const width = document.body.clientWidth;
  const height = document.body.clientHeight;
  const unit = width / 100;
  const scale = window.devicePixelRatio || 1;
  const painters = [];
  for (const { ground, light, spec } of arts) {
    for (const canvas of [ground, light]) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    }
    const base = colour('--ground');
    const ink = colour('--ink');
    const glow = spec.tint ? mix(colour(`--${spec.tint}`), ink, 0.55) : ink;
    const signal = { x: spec.signal.x * width, y: spec.signal.y * height };
    const deep = mix(base, [0, 0, 0], 0.42);

    // The ground: the tone's colour, lifted a little around the signal and sinking toward the edges.
    const g = ground.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = rgba(deep, 1);
    g.fillRect(0, 0, width, height);
    const lift = g.createRadialGradient(signal.x, signal.y, 0, signal.x, signal.y, Math.hypot(width, height) * 0.8);
    lift.addColorStop(0, rgba(mix(base, glow, 0.86), 1));
    lift.addColorStop(0.35, rgba(base, 1));
    lift.addColorStop(1, rgba(deep, 1));
    g.fillStyle = lift;
    g.fillRect(0, 0, width, height);
    // Dust: a few hundred faint grains, more of them dim than bright.
    const random = seeded(edition.number.charCodeAt(0) * 7919 + (spec.seed ?? 0));
    for (let i = 0; i < 420; i++) {
      const size = (0.25 + random() ** 3 * 1.1) * unit * 0.12;
      g.fillStyle = rgba(ink, 0.04 + random() ** 2.4 * 0.42);
      g.beginPath();
      g.arc(random() * width, random() * height, size, 0, Math.PI * 2);
      g.fill();
    }

    const l = light.getContext('2d');
    l.scale(scale, scale);
    const step = spec.spacing * unit;
    const reach = spec.reach * width;
    const course = spec.course && { x: spec.course.x * width, y: spec.course.y * height, at: spec.course.at };
    painters.push(t => {
      l.clearRect(0, 0, width, height);
      const found = easeEnter(clamp01((t - spec.at) / 2.2));
      if (found <= 0) return;
      const phase = (t / PULSE) % 1;
      // Rings of light: each one soft (a wide faint stroke under a fine one), dimming as it travels.
      for (let i = 0; ; i++) {
        const r = (i + phase) * step;
        if (r > reach) break;
        const fade = Math.exp(-r / (reach * 0.26)) * (1 - (r / reach) ** 3) * found;
        if (r < step * 0.25) continue;
        for (const [lineWidth, alpha] of [[1.8, 0.05], [0.6, 0.11], [0.14, 0.4]]) {
          l.strokeStyle = rgba(glow, alpha * fade);
          l.lineWidth = lineWidth * unit;
          l.beginPath();
          l.arc(signal.x, signal.y, r, 0, Math.PI * 2);
          l.stroke();
        }
      }
      // The point: a bloom that swells as each pulse leaves it and settles before the next.
      const beat = Math.exp(-phase * 6);
      const bloomR = unit * (5 + beat * 3);
      const bloom = l.createRadialGradient(signal.x, signal.y, 0, signal.x, signal.y, bloomR);
      bloom.addColorStop(0, rgba(glow, (0.55 + beat * 0.3) * found));
      bloom.addColorStop(0.18, rgba(glow, (0.16 + beat * 0.12) * found));
      bloom.addColorStop(1, rgba(glow, 0));
      l.fillStyle = bloom;
      l.beginPath();
      l.arc(signal.x, signal.y, bloomR, 0, Math.PI * 2);
      l.fill();
      l.fillStyle = rgba(mix(glow, [255, 255, 255], 0.6), found);
      l.beginPath();
      l.arc(signal.x, signal.y, unit * 0.45, 0, Math.PI * 2);
      l.fill();
      // The course: from below the frame toward the signal, faint where we are, clearer near it.
      if (course) {
        const drawn = easeMove(clamp01((t - course.at) / 2.4));
        if (drawn > 0) {
          const gap = unit * 2.2;
          const length = Math.hypot(signal.x - course.x, signal.y - course.y) - gap;
          const angle = Math.atan2(signal.y - course.y, signal.x - course.x);
          const end = { x: course.x + Math.cos(angle) * length * drawn, y: course.y + Math.sin(angle) * length * drawn };
          const line = l.createLinearGradient(course.x, course.y, signal.x, signal.y);
          line.addColorStop(0, rgba(ink, 0));
          line.addColorStop(0.45, rgba(ink, 0.04));
          line.addColorStop(0.8, rgba(ink, 0.26));
          line.addColorStop(1, rgba(ink, 0.55));
          l.strokeStyle = line;
          l.lineWidth = unit * 0.12;
          l.beginPath();
          l.moveTo(course.x, course.y);
          l.lineTo(end.x, end.y);
          l.stroke();
        }
      }
    });
  }
  return t => {
    for (const paint of painters) paint(t);
  };
}

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
/** The teaser: the dark, one signal, and the date. */
function teaser() {
  return {
    label: `TERMINAL Session ${edition.number} 티저`,
    tone: 'night',
    duration: pulses(8),
    nodes: [
      ...art({ signal: { x: 0.64, y: 0.36 }, spacing: 4.2, reach: 0.62, course: { x: 0.2, y: 1.06, at: 3.4 }, at: 0.5 }),
      h(
        'div',
        { class: 'layout' },
        top(2.4),
        h('div', { class: 'spacer' }),
        h(
          'div',
          { class: 'teaserFoot' },
          cue(h('p', { class: 'teaserDate' }, fitLine(dateShort, 'date', 26)), 4.4, 1.6),
          cue(h('div', { class: 'teaserMeta' }, balance(edition.title).map(line => mono(line, 'strong')), mono(`${weekday} · ${edition.time} KST`), mono(edition.venue)), 5, 1.4),
        ),
      ),
    ],
  };
}

/** One artist: a poster per name, the signal set elsewhere each time and tinted in the artist's role. */
function artist() {
  const index = Math.max(0, artists.findIndex(item => item.id === params.get('artist')));
  const person = artists[index];
  const tint = ['feature', 'calm', 'mark', 'fresh', 'alert'][index % 5];
  const spots = [
    { signal: { x: 0.7, y: 0.28 }, course: { x: 0.22, y: 1.06 } },
    { signal: { x: 0.3, y: 0.3 }, course: { x: 0.8, y: 1.06 } },
    { signal: { x: 0.66, y: 0.36 }, course: { x: 0.14, y: 1.06 } },
    { signal: { x: 0.36, y: 0.26 }, course: { x: 0.86, y: 1.06 } },
  ];
  const spot = spots[index % spots.length];
  return {
    label: `TERMINAL Session ${edition.number} 아티스트 공개: ${person.name}`,
    tone: 'night',
    duration: pulses(6),
    nodes: [
      ...art({ signal: spot.signal, spacing: 4, reach: 0.56, tint, seed: index + 1, course: { ...spot.course, at: 2.6 }, at: 0.4 }),
      h(
        'div',
        { class: 'layout' },
        top(1.8),
        h('div', { class: 'spacer' }),
        h('h1', { class: 'name' }, balance(person.name).map((line, i) => cue(fitLine(line, 'name', 24), 2.6 + i * 0.25, 1.4, 'rise'))),
        cue(h('p', { class: 'kicker' }, mono(`Dock ${person.dock}`, 'strong')), 3.4, 1),
        info(3.8),
      ),
    ],
  };
}

/** The lineup: every name on its own rule under the signal. */
function lineup() {
  const settled = 2 + artists.length * 0.3 + 1;
  return {
    label: `TERMINAL Session ${edition.number} 라인업 공개`,
    tone: 'night',
    duration: Math.ceil((settled + 4.4) / PULSE) * PULSE,
    nodes: [
      ...art({ signal: { x: 0.76, y: 0.18 }, spacing: 3.8, reach: 0.5, course: { x: 0.12, y: 1.06, at: 1.6 }, at: 0.4 }),
      h(
        'div',
        { class: 'layout' },
        top(1.2),
        h('div', { class: 'spacer' }),
        cue(h('p', { class: 'rosterHead' }, mono('Lineup', 'strong')), 1.8, 1),
        h(
          'ol',
          { class: 'roster' },
          artists.map((person, i) => cue(h('li', {}, h('b', {}, fitLine(person.name, 'roster', 11)), mono(`Dock ${person.dock}`)), 2 + i * 0.3, 1, 'plate')),
        ),
        info(settled),
      ),
    ],
  };
}

/** Lineup by dock once it is out; until then the main poster says it is to be announced. */
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

/** The main poster: the signal high in the dark, the title below it, the lineup, the essentials. */
function main() {
  return {
    label: `TERMINAL Session ${edition.number}: ${edition.title} 메인 포스터`,
    tone: 'night',
    duration: pulses(9),
    nodes: [
      ...art({ signal: { x: 0.7, y: 0.27 }, spacing: 4.2, reach: 0.6, course: { x: 0.16, y: 1.06, at: 2.4 }, at: 0.5 }),
      h(
        'div',
        { class: 'layout' },
        top(1.6),
        h('div', { class: 'spacer' }),
        h('h1', { class: 'title' }, balance(edition.title).map((line, i) => cue(fitLine(line, 'title', 14), 3 + i * 0.25, 1.4, 'rise'))),
        lineupBlock(4),
        info(4.4),
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
