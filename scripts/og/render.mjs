import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Renders scripts/og/share.html to public/og/terminal-share.png. A local tool: it needs Playwright
 * (PLAYWRIGHT_DIR, a folder whose node_modules has it). The site's fonts are inlined, since a page
 * opened from a file may not load fonts from other files.
 */
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'noop.js'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const html = readFileSync('scripts/og/share.html', 'utf8').replace(/url\(\.\.\/\.\.\/(public\/fonts\/[^)]+)\)/g,
  (_, file) => `url(data:font/woff2;base64,${readFileSync(file).toString('base64')})`);
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.locator('#og').screenshot({ path: 'public/og/terminal-share.png' });
await browser.close();
console.log('✓ public/og/terminal-share.png');
