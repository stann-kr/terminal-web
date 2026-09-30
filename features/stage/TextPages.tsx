'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { defaultMeasurer, fontOf, paginate, whenFontsReady, type TextPage } from './text';
import { pageAnnouncement, pageKey, pageReadout, useStageMode, useWheelPaging } from './usePaging';
import styles from './stage.module.css';

/**
 * Long text on a fixed plate: on the stage it is cut into pages that fit the space it is given
 * (measured with pretext at the real font and width) and turned by wheel, keys or buttons. In flow
 * mode, or where text cannot be measured, it is simply all there.
 */
export function TextPages({ paragraphs, language, label, empty }: { paragraphs: string[]; language?: 'ko' | 'en'; label: string; empty?: string }) {
  const mode = useStageMode();
  const frame = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<TextPage[] | null>(null);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const source = paragraphs.join('\u0000');

  useLayoutEffect(() => {
    const element = frame.current;
    const measurer = defaultMeasurer();
    if (mode !== 'stage' || !element || !measurer || !paragraphs.length) {
      setPages(null);
      return;
    }
    const run = () => {
      const probe = element.querySelector('p') ?? element;
      const style = getComputedStyle(probe);
      const size = parseFloat(style.fontSize) || 16;
      const lineHeight = parseFloat(style.lineHeight) || size * 1.75;
      setPages(paginate(paragraphs, {
        font: fontOf(style),
        lineHeight,
        width: element.clientWidth,
        // A couple of px of slack for sub-pixel line boxes.
        height: element.clientHeight - 2,
        paragraphGap: parseFloat(getComputedStyle(element).getPropertyValue('--para-gap')) || 10,
        options: { keepAll: language !== 'en' },
      }, measurer));
    };
    run();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    observer?.observe(element);
    const stop = whenFontsReady(run);
    return () => {
      observer?.disconnect();
      stop();
    };
    // `source` stands for the paragraphs' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source, language]);

  const count = pages?.length ?? 1;
  const current = Math.min(page, count - 1);
  const turn = (step: 1 | -1) => {
    const next = current + step;
    if (next < 0 || next >= count) return;
    setDirection(step);
    setPage(next);
  };
  const turns = { prev: current > 0 ? () => turn(-1) : undefined, next: current < count - 1 ? () => turn(1) : undefined };
  useWheelPaging(region, turns, mode === 'stage' && count > 1);

  const chunks = pages ? pages[current] : paragraphs.map((text, paragraph) => ({ paragraph, text }));
  return (
    <div
      ref={region}
      className={styles.textPages}
      role="group"
      aria-label={label}
      data-pages={count > 1 || undefined}
      onKeyDown={count > 1 ? event => {
        const key = pageKey(event.nativeEvent);
        if (!key) return;
        event.preventDefault();
        event.stopPropagation();
        turn(key === 'prev' ? -1 : 1);
      } : undefined}
    >
      <div ref={frame} className={styles.textFrame} data-fit="">
        {paragraphs.length ? (
          <div key={current} className={styles.textPage} lang={language} data-direction={direction}>
            {chunks.map((chunk, index) => <p key={`${chunk.paragraph}:${index}`}>{chunk.text}</p>)}
          </div>
        ) : (
          empty && <p className={styles.textEmpty}>{empty}</p>
        )}
      </div>
      {/* On the stage the pager row is always reserved, so the text frame never changes height
          (and page count) because the pager came or went. */}
      {mode === 'stage' && paragraphs.length > 0 && (
        <div className={styles.textPager} data-single={count < 2 || undefined}>
          <button type="button" onClick={() => turn(-1)} disabled={!turns.prev} aria-label="이전 쪽" hidden={count < 2}>PREV</button>
          <span aria-hidden="true">{count > 1 && pageReadout(current + 1, count)}</span>
          <span className={styles.srOnly} aria-live="polite">{count > 1 ? pageAnnouncement(current + 1, count) : ''}</span>
          <button type="button" onClick={() => turn(1)} disabled={!turns.next} aria-label="다음 쪽" hidden={count < 2}>NEXT</button>
        </div>
      )}
    </div>
  );
}
