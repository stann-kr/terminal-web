import { clearCache, layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

// The only place that imports pretext (0.0.x, pinned): its API may move, so it stays behind the
// small `Measurer` seam below. Everything else takes a measurer, which tests replace with a fake.

export interface WrappedLine {
  text: string;
  width: number;
}
export interface WrapOptions {
  letterSpacing?: number;
  /** Korean keeps words whole, like the CSS `word-break: keep-all` the page uses. */
  keepAll?: boolean;
}
export interface Measurer {
  wrap(text: string, font: string, width: number, options?: WrapOptions): WrappedLine[];
}

const pretextMeasurer: Measurer = {
  wrap(text, font, width, options = {}) {
    const prepared = prepareWithSegments(text, font, {
      whiteSpace: 'pre-wrap',
      wordBreak: options.keepAll === false ? 'normal' : 'keep-all',
      letterSpacing: options.letterSpacing,
    });
    return layoutWithLines(prepared, width, 1).lines.map(line => ({ text: line.text, width: line.width }));
  },
};

/** Canvas text measurement exists (browsers); on the server and in jsdom nothing is measured. */
export function defaultMeasurer(): Measurer | null {
  return typeof OffscreenCanvas === 'undefined' ? null : pretextMeasurer;
}

/** Measurements taken before the web fonts arrive used fallback faces; drop them and measure again. */
export function whenFontsReady(then: () => void): () => void {
  let live = true;
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  fonts?.ready.then(() => {
    if (!live) return;
    clearCache();
    then();
  });
  return () => {
    live = false;
  };
}

/** A CSS font shorthand for canvas measurement, read from an element's computed style. */
export function fontOf(style: Pick<CSSStyleDeclaration, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>, sizePx?: number): string {
  const size = sizePx === undefined ? style.fontSize : `${sizePx}px`;
  return `${style.fontStyle === 'normal' ? '' : `${style.fontStyle} `}${style.fontWeight} ${size} ${style.fontFamily}`;
}

export interface TextChunk {
  /** Index of the source paragraph. */
  paragraph: number;
  text: string;
}
export type TextPage = TextChunk[];
export interface PageFrame {
  font: string;
  lineHeight: number;
  width: number;
  height: number;
  /** Space after each paragraph (the CSS margin). */
  paragraphGap: number;
  options?: WrapOptions;
}

/** Line boundaries of `text` as character offsets, or null when the lines do not add back up. */
function lineOffsets(text: string, lines: WrappedLine[]): number[] | null {
  const ends: number[] = [];
  let at = 0;
  for (const line of lines) {
    if (!text.startsWith(line.text, at)) return null;
    at += line.text.length;
    while (text[at] === '\n') at += 1; // hard breaks are not part of a line's text
    ends.push(at);
  }
  return at === text.length ? ends : null;
}

/**
 * Splits paragraphs into pages that fit `frame`, breaking inside a paragraph when it has to (never
 * leaving a single line behind when two fit). When lines cannot be measured or do not add back up to
 * the source, everything stays on one page and the caller's fit check has the final say.
 */
export function paginate(paragraphs: readonly string[], frame: PageFrame, measurer: Measurer | null): TextPage[] {
  const whole: TextPage = paragraphs.map((text, paragraph) => ({ paragraph, text }));
  if (!measurer || !paragraphs.length || frame.width <= 0 || frame.height < frame.lineHeight) return [whole];
  const capacity = Math.max(1, Math.floor((frame.height + 0.5) / frame.lineHeight));
  const pages: TextPage[] = [[]];
  let used = 0; // px used on the current page
  for (const [paragraph, text] of paragraphs.entries()) {
    const lines = measurer.wrap(text, frame.font, frame.width, frame.options);
    const ends = lineOffsets(text, lines);
    if (!ends) return [whole];
    let line = 0;
    while (line < lines.length) {
      const gap = pages[pages.length - 1].length ? frame.paragraphGap : 0;
      const room = Math.floor((frame.height - used - gap + 0.5) / frame.lineHeight);
      const left = lines.length - line;
      // Start a new page rather than strand one line here, unless the page is still empty.
      if ((room < Math.min(2, left) && pages[pages.length - 1].length) || room < 1) {
        pages.push([]);
        used = 0;
        continue;
      }
      const take = Math.min(left, room, capacity);
      const from = line ? ends[line - 1] : 0;
      pages[pages.length - 1].push({ paragraph, text: text.slice(from, ends[line + take - 1]).trim() });
      used += gap + take * frame.lineHeight;
      line += take;
    }
  }
  return pages.filter(page => page.length);
}

export interface TitleFrame {
  /** Font shorthand for a size in px. */
  font: (px: number) => string;
  width: number;
  maxLines: number;
  minPx: number;
  maxPx: number;
  /** Letter spacing as a share of the size (CSS `em`). */
  letterSpacingEm?: number;
  /**
   * Width the shown text takes beyond what is measured, as a share of the size: a word set in a
   * wider face than the measured one (the brand word). It is kept free on every line.
   */
  reserveEm?: number;
  options?: Omit<WrapOptions, 'letterSpacing'>;
}

/** The largest whole-pixel size at which `text` fits `maxLines` lines of `width`; `maxPx` when unmeasured. */
export function fitTitle(text: string, frame: TitleFrame, measurer: Measurer | null): number {
  if (!measurer || !text || frame.width <= 0) return frame.maxPx;
  const words = text.split(/\s+/).filter(Boolean);
  const fits = (px: number) => {
    const width = frame.width - (frame.reserveEm ?? 0) * px;
    if (width <= 0) return false;
    const font = frame.font(px);
    const options = { ...frame.options, letterSpacing: (frame.letterSpacingEm ?? 0) * px };
    // A title never breaks inside a word (the layout would split an overlong word into lines that
    // each fit, as CSS overflow-wrap does): every word must fit a line on its own.
    if (words.some(word => (measurer.wrap(word, font, width * 1000, options)[0]?.width ?? 0) > width + 0.5)) return false;
    const lines = measurer.wrap(text, font, width, options);
    return lines.length <= frame.maxLines && lines.every(line => line.width <= width + 0.5);
  };
  let low = Math.floor(frame.minPx);
  let high = Math.floor(frame.maxPx);
  if (fits(high)) return high;
  if (!fits(low)) return low;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/** Groups item heights into pages of `height`, in order; an item taller than a page gets its own. */
export function packHeights(heights: readonly number[], height: number, gap: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  heights.forEach((itemHeight, index) => {
    const page = pages[pages.length - 1];
    const needed = (page.length ? gap : 0) + itemHeight;
    if (page.length && used + needed > height) {
      pages.push([index]);
      used = itemHeight;
    } else {
      page.push(index);
      used += needed;
    }
  });
  return pages.filter(page => page.length);
}

/**
 * How much wider a word is in its own face (`own`) than in the face it is measured in (`font`), as a
 * share of the size: what a title fitted in `font` keeps free for it. Never below zero.
 */
export function wordReserveEm(
  word: string,
  font: (px: number) => string,
  letterSpacingEm: number,
  own: (px: number) => string,
  ownLetterSpacingEm: number,
  measurer: Measurer,
): number {
  const ref = 100;
  const width = (shorthand: string, spacingEm: number) => measurer.wrap(word, shorthand, ref * 1000, { letterSpacing: spacingEm * ref })[0]?.width ?? 0;
  return Math.max(0, (width(own(ref), ownLetterSpacingEm) - width(font(ref), letterSpacingEm)) / ref);
}
