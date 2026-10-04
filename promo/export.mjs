/**
 * Renders the promo set to files with the local Chrome and ffmpeg (no npm dependency):
 *   out/posters/<piece>.png   every poster; A2 at 300 dpi, plus a vector out/posters/main_a2.pdf
 *   out/motion/<piece>.mp4    every motion piece, H.264 at 30 fps
 *
 *   node promo/export.mjs [posters|motion|all|templates] [--only <text>]
 *
 * `templates` writes out/templates/<piece>.png: the pieces that wait for the lineup, with sample names.
 *
 * Chrome is driven over the DevTools protocol; each frame is the composition seeked to an exact time,
 * so the video does not depend on how fast the machine renders. The browser is CHROME_PATH, else
 * Playwright's chrome-headless-shell if one is installed, else Google Chrome.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { fileName, formats, motions, pieceQuery, posters, templates } from './pieces.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = process.env.CHROME_PATH ?? (await headlessShell()) ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const A2_DPI = 300;

const args = process.argv.slice(2);
const set = ['posters', 'motion', 'all', 'templates'].includes(args[0]) ? args[0] : 'all';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const selected = list => list.filter(item => !only || fileName(item).includes(only));

/** The newest chrome-headless-shell Playwright has downloaded (macOS cache), if any. */
async function headlessShell() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const builds = (await readdir(cache).catch(() => [])).filter(name => name.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const build of builds) {
    const platform = (await readdir(join(cache, build)).catch(() => [])).find(name => name.startsWith('chrome-headless-shell-'));
    if (platform) return join(cache, build, platform, 'chrome-headless-shell');
  }
  return null;
}

/** A minimal DevTools protocol client over the browser's WebSocket. */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let next = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('the browser closed its DevTools connection'));
    pending.clear();
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}`));
      else resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  // A call the browser never answers fails the run instead of hanging it.
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 60_000);
      const settle = fn => value => {
        clearTimeout(timer);
        fn(value);
      };
      pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const once = (method, sessionId) =>
    new Promise(resolve => {
      const listener = message => {
        if (message.method === method && message.sessionId === sessionId) {
          listeners.delete(listener);
          resolve(message.params);
        }
      };
      listeners.add(listener);
    });
  return { send, once, close: () => socket.close() };
}

async function launchChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'promo-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-color-profile=srgb', '--no-first-run', '--no-default-browser-check', 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = '';
  const url = await new Promise((resolve, reject) => {
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on('exit', code => reject(new Error(`Chrome exited before it was ready (${code})\n${log}`)));
    setTimeout(() => {
      chrome.kill();
      reject(new Error(`Chrome did not start within 20s: ${CHROME}\nSet CHROME_PATH to a working Chrome or chrome-headless-shell.`));
    }, 20_000).unref();
  });
  let closing = false;
  chrome.on('exit', (code, signal) => {
    if (!closing) console.error(`Chrome exited during the run (${code ?? signal})\n${log.slice(-2000)}`);
  });
  return {
    url,
    async close() {
      closing = true;
      chrome.kill();
      await new Promise(resolve => chrome.once('exit', resolve));
      await rm(profile, { recursive: true, force: true });
    },
  };
}

async function openPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => cdp.send(method, params, sessionId);
  await page('Page.enable');
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  /** Loads a piece at its canvas size and waits until it is laid out. */
  const load = async (url, { width, height }, scale = 1) => {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    const loaded = cdp.once('Page.loadEventFired', sessionId);
    await page('Page.navigate', { url });
    await loaded;
    const state = await evaluate('window.promo.ready');
    if (state.overflow.length) console.warn(`  ! ${url.split('?')[1]}: content overflows ${state.overflow.join(', ')}`);
    return state;
  };
  // The screenshot that follows renders a fresh frame; waiting on requestAnimationFrame can stall headless.
  const seek = t => evaluate(`window.promo.seek(${t})`);
  const shot = async (format = 'png') => Buffer.from((await page('Page.captureScreenshot', format === 'png' ? { format } : { format, quality: 95 })).data, 'base64');
  const pdf = async paper => Buffer.from((await page('Page.printToPDF', { paperWidth: paper.width / 25.4, paperHeight: paper.height / 25.4, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, printBackground: true })).data, 'base64');
  return { load, seek, shot, pdf };
}

/** Encodes JPEG frames piped in, in order, to an H.264 file most players and Instagram accept. */
function encoder(file, fps) {
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-vf', 'scale=out_color_matrix=bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', file], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((resolve, reject) => ffmpeg.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  return {
    write: frame => (ffmpeg.stdin.write(frame) ? Promise.resolve() : new Promise(resolve => ffmpeg.stdin.once('drain', resolve))),
    end: () => {
      ffmpeg.stdin.end();
      return done;
    },
  };
}

/**
 * Headless Chrome drops its DevTools connection after it has sent a large amount of screenshot data
 * in one session. A fresh browser takes over at a byte budget, and when the connection drops anyway
 * the step is retried in a new browser: the piece is reloaded and seeked back to the same time, which
 * the timeline makes seamless.
 */
const BYTES_PER_BROWSER = 32 * 1024 * 1024;
const RETRIES = 3;
function renderer() {
  let browser = null;
  let page = null;
  let sent = 0;
  let loaded = null;
  let time = null;
  const close = async () => {
    if (!browser) return;
    browser.cdp.close();
    await browser.chrome.close();
    browser = null;
  };
  /** A fresh browser on the piece and the time the last one was at. */
  const reopen = async () => {
    await close();
    const chrome = await launchChrome();
    browser = { chrome, cdp: await connect(chrome.url) };
    page = await openPage(browser.cdp);
    sent = 0;
    if (loaded) await page.load(...loaded);
    if (time != null) await page.seek(time);
  };
  const attempt = async step => {
    for (let tries = 0; ; tries++) {
      try {
        if (!browser || sent >= BYTES_PER_BROWSER) await reopen();
        return await step();
      } catch (error) {
        if (tries >= RETRIES) throw error;
        await close();
      }
    }
  };
  return {
    async load(...args) {
      loaded = args;
      time = null;
      sent = BYTES_PER_BROWSER;
      return attempt(() => page.load(...args));
    },
    seek(t) {
      time = t;
      return attempt(() => page.seek(t));
    },
    shot(format) {
      return attempt(async () => {
        const frame = await page.shot(format);
        sent += frame.length;
        return frame;
      });
    },
    pdf: paper => attempt(() => page.pdf(paper)),
    close,
  };
}

const server = await startServer({ port: 0, host: '127.0.0.1' });
const base = `http://127.0.0.1:${server.address().port}/`;
const page = renderer();
try {
  if (set === 'posters' || set === 'all' || set === 'templates') {
    const folder = set === 'templates' ? 'templates' : 'posters';
    await mkdir(join(here, 'out', folder), { recursive: true });
    for (const item of selected(set === 'templates' ? templates : posters)) {
      const format = formats[item.format];
      const scale = format.paper ? (A2_DPI * format.paper.width) / 25.4 / format.width : 1;
      const { hold } = await page.load(base + pieceQuery(item), format, scale);
      await page.seek(hold);
      const file = join(here, 'out', folder, fileName(item));
      await writeFile(`${file}.png`, await page.shot());
      if (item.pdf) await writeFile(`${file}.pdf`, await page.pdf(format.paper));
      console.log(`poster  ${fileName(item)}${item.pdf ? ' (+pdf)' : ''}`);
    }
  }
  if (set === 'motion' || set === 'all') {
    await mkdir(join(here, 'out/motion'), { recursive: true });
    for (const item of selected(motions)) {
      const { duration, fps } = await page.load(base + pieceQuery(item), formats[item.format]);
      const video = encoder(join(here, 'out/motion', `${fileName(item)}.mp4`), fps);
      const frames = Math.round(duration * fps);
      for (let frame = 0; frame < frames; frame++) {
        await page.seek(frame / fps);
        await video.write(await page.shot('jpeg'));
      }
      await video.end();
      console.log(`motion  ${fileName(item)} (${frames} frames)`);
    }
  }
} finally {
  await page.close();
  server.close();
}
