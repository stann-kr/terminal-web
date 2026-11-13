/**
 * Serves the promo kit and nothing else of the repository: the promo folder itself, the site's
 * palette and global stylesheet (the one source of colours, type and surfaces) and its fonts.
 *
 *   node promo/serve.mjs            → http://0.0.0.0:3007
 *   PROMO_PORT=4000 node promo/serve.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** A request URL or path that cannot be read (bad percent-encoding, `//`): answered with 400. */
const BAD_PATH = Symbol('bad path');

/** Where a request path is read from, null when it is outside the kit, BAD_PATH when unreadable. */
function resolve(pathname) {
  if (pathname === '/') return join(here, 'index.html');
  if (pathname === '/palettes.css') return join(root, 'app/palettes.css');
  if (pathname === '/globals.css') return join(root, 'app/globals.css');
  const [base, prefix] = pathname.startsWith('/fonts/') ? [join(root, 'public/fonts'), '/fonts/'] : [here, '/'];
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice(prefix.length));
  } catch (error) {
    if (error instanceof URIError) return BAD_PATH;
    throw error;
  }
  const file = normalize(join(base, decoded));
  return file.startsWith(base + sep) ? file : null;
}

export function startServer({ port = 3007, host = '0.0.0.0' } = {}) {
  const server = createServer(async (request, response) => {
    const file = URL.canParse(request.url ?? '/', 'http://promo') ? resolve(new URL(request.url ?? '/', 'http://promo').pathname) : BAD_PATH;
    if (file === BAD_PATH) {
      response.writeHead(400).end();
      return;
    }
    if (!file || file.endsWith('.mjs')) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise(done => server.listen(port, host, () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer({ port: Number(process.env.PROMO_PORT ?? 3007) });
  const { port } = server.address();
  console.log(`promo kit on :${port}`);
}
