'use client';
import { useLayoutEffect, useRef, useState } from 'react';

const LATIN = '#%&*+/<=>?@\\|~01ABDEFHKMNRSTXZ';
const HANGUL = '갸녀됴류뮤뷰슈져쳐튜퓨휴';

function noise(char: string, index: number, tick: number) {
  if (char === ' ' || char === '\n') return char;
  const set = /[ᄀ-ᇿ㄰-㆏가-힣]/.test(char) ? HANGUL : LATIN;
  return set[(index * 7 + tick * 3) % set.length];
}

/**
 * Prints `text` as if a terminal were decoding it: characters resolve left to right from glyph noise.
 * The first frame is set before paint, so there is no flash of the final text. Without motion
 * support (reduced motion, paused display, test DOM) the text renders plainly.
 */
export function Decode({ text, duration = 480 }: { text: string; duration?: number }) {
  const [state, setState] = useState({ source: text, shown: text });
  // A new text resets the display during render; the layout effect then decodes it.
  if (state.source !== text) setState({ source: text, shown: text });
  const setShown = (shown: string) => setState({ source: text, shown });
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const still = typeof window.matchMedia !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || window.matchMedia('(forced-colors: active)').matches
      || !!node?.closest('[data-display-paused]');
    if (still) return;
    const chars = Array.from(text);
    const start = performance.now();
    let frame = 0;
    const render = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const resolved = Math.floor(progress * chars.length);
      const tick = Math.floor((now - start) / 45);
      setShown(chars.map((char, index) => index < resolved ? char : noise(char, index, tick)).join(''));
      if (progress < 1) frame = requestAnimationFrame(render);
    };
    render(start);
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setShown is a fresh closure over `text`, already a dependency.
  }, [text, duration]);
  return <span ref={ref}>{state.shown}</span>;
}
