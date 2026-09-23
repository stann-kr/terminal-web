'use client';

import { useRef, type RefObject } from 'react';
import { gsap, useGSAP, useMotionEnabled } from './MotionProvider';

/** Only an explicitly decorative title can leave phosphor behind. Never copy a page/form. */
export function CrtSurface({ main, viewKey, motionKey }: { main: RefObject<HTMLElement | null>; viewKey: string; motionKey: string }) {
  const surface = useRef<HTMLDivElement>(null);
  const persistence = useRef<HTMLDivElement>(null);
  const previous = useRef<{ view: string; text: string; source: HTMLElement; copy: HTMLElement; visible: boolean } | null>(null);
  const enabled = useMotionEnabled();

  useGSAP(() => {
    const glass = surface.current;
    const echo = persistence.current;
    const content = main.current;
    if (!glass || !echo || !content) return;
    if (!enabled) { previous.current = null; echo.replaceChildren(); return; }

    const title = content.querySelector('[data-readout-ghost]')?.parentElement;
    const source = title?.querySelector<HTMLElement>('[data-readout-source]');
    const last = previous.current;
    const text = source?.textContent ?? '';
    const changed = last && (last.view !== viewKey || (source && last.text !== text));
    let decay: gsap.core.Tween | undefined;
    let sync: gsap.core.Timeline | undefined;

    if (changed && last.visible) {
      echo.replaceChildren(last.copy.cloneNode(true));
      // This is the old title at its old screen position, not a duplicate of the new text.
      decay = gsap.fromTo(echo, { opacity: .34 }, {
        opacity: 0, duration: 1.4, ease: 'power2.out', onComplete: () => echo.replaceChildren(),
      });
      sync = gsap.timeline().fromTo(echo, { x: -1.5 }, { x: .75, duration: .07, ease: 'none' })
        .to(echo, { x: 0, duration: .07, ease: 'none' });
    }

    if (source && !source.closest('form,[role=alert],[role=status]')) {
      const style = getComputedStyle(source);
      const copy = source.cloneNode(true) as HTMLElement;
      copy.removeAttribute('data-readout-source');
      copy.className = 'tm-persistence-title';
      Object.assign(copy.style, {
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
        lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textAlign: style.textAlign,
        whiteSpace: style.whiteSpace, color: style.color, opacity: '1', clipPath: 'none',
      });
      previous.current = { view: viewKey, text, source, copy, visible: false };
    } else previous.current = null;

    // Refresh the old title's screen position while scrolling, without copying values or full DOM.
    const rememberPosition = () => {
      const saved = previous.current;
      if (!saved?.source.isConnected) { previous.current = null; return; }
      const bounds = saved.source.getBoundingClientRect();
      const viewport = content.getBoundingClientRect();
      const screen = glass.getBoundingClientRect();
      saved.visible = bounds.width > 0 && bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
      Object.assign(saved.copy.style, {
        left: `${bounds.left - screen.left}px`, top: `${bounds.top - screen.top}px`, width: `${bounds.width}px`,
      });
    };
    rememberPosition();
    const clear = () => { decay?.kill(); sync?.kill(); echo.replaceChildren(); };
    const scroll = () => { clear(); rememberPosition(); };
    const resize = () => { clear(); previous.current = null; };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches('input,textarea,select,[contenteditable=true]')) clear();
    };
    content.addEventListener('scroll', scroll, { passive: true });
    content.addEventListener('input', clear);
    content.addEventListener('keydown', clear);
    content.addEventListener('focusin', focus);
    window.addEventListener('resize', resize);
    return () => {
      clear();
      content.removeEventListener('scroll', scroll);
      content.removeEventListener('input', clear);
      content.removeEventListener('keydown', clear);
      content.removeEventListener('focusin', focus);
      window.removeEventListener('resize', resize);
    };
  }, { scope: surface, dependencies: [enabled, motionKey, viewKey, main], revertOnUpdate: true });

  return <div ref={surface} className="tm-glass" aria-hidden="true">
    <div className="tm-phosphor" />
    <div ref={persistence} className="tm-persistence" />
    <div className="tm-scan-glow" />
    <div className="tm-grain" />
    <div className="tm-raster" />
    <div className="tm-vignette" />
    <div className="tm-reflection" />
    <div data-shell-charge className="tm-shell-charge" />
  </div>;
}
