import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Renders an OG template (scripts/og/*.html, 1200 × 630) to a PNG. A local tool: it needs
 * Playwright (PLAYWRIGHT_DIR, a folder whose node_modules has it). The site's fonts are inlined,
 * since a page opened from a file may not load fonts from other files. `{{KEY}}` in the template
 * is replaced by `values.KEY`, HTML-escaped.
 *
 *   node scripts/og/render.mjs        the site's share image, public/og/terminal-share.png
 */
const escape = value => String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function renderOg(template, out, values = {}) {
  const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'noop.js'));
  const { chromium } = require('playwright');
  const html = readFileSync(template, 'utf8')
    .replace(/url\(\.\.\/\.\.\/(public\/fonts\/[^)]+)\)/g,
      (_, file) => `url(data:font/woff2;base64,${readFileSync(file).toString('base64')})`)
    .replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`${template}: no value for {{${key}}}`);
      return escape(values[key]);
    });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(path.dirname(out), { recursive: true });
    await page.locator('#og').screenshot({ path: out });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await renderOg('scripts/og/share.html', 'public/og/terminal-share.png');
  console.log('✓ public/og/terminal-share.png');
}
