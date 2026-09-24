'use client';
import type { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { createReadout } from './readout';

gsap.registerPlugin(useGSAP);

export function useDisplayMotion(root: RefObject<HTMLDivElement | null>, key: string) {
  useGSAP(() => {
    const element = root.current;
    if (!element || typeof window.matchMedia !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrast = window.matchMedia('(forced-colors: active)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const enabled = () => !reduced.matches && !contrast.matches && !connection?.saveData && document.visibilityState !== 'hidden';
    const readout = createReadout(element,enabled);
    const policyChanged = () => {
      element.toggleAttribute('data-display-paused',!enabled());
      if (!enabled()) readout.finish();
    };
    // Each readout owns a short-lived GSAP context, including observer-triggered arrivals.
    const reveal = () => {
      try { readout.reveal(); } catch { readout.finish(); }
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node => node instanceof HTMLElement && !node.closest('[data-readout-live]')))) reveal();
    });
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches('input,textarea,select,button,a,[contenteditable="true"]')) readout.finish();
    };
    policyChanged();
    reveal();
    observer.observe(element,{childList:true,subtree:true});
    element.addEventListener('pointerdown',readout.finish,true);
    element.addEventListener('keydown',readout.finish,true);
    element.addEventListener('wheel',readout.finish,{passive:true});
    element.addEventListener('scroll',readout.finish,{capture:true,passive:true});
    element.addEventListener('focusin',onFocus);
    window.addEventListener('resize',readout.finish);
    document.fonts?.addEventListener('loadingdone',readout.finish);
    document.addEventListener('visibilitychange',policyChanged);
    reduced.addEventListener('change',policyChanged);
    contrast.addEventListener('change',policyChanged);
    connection?.addEventListener('change',policyChanged);
    return () => {
      observer.disconnect();
      readout.dispose();
      element.removeEventListener('pointerdown',readout.finish,true);
      element.removeEventListener('keydown',readout.finish,true);
      element.removeEventListener('wheel',readout.finish);
      element.removeEventListener('scroll',readout.finish,true);
      element.removeEventListener('focusin',onFocus);
      window.removeEventListener('resize',readout.finish);
      document.fonts?.removeEventListener('loadingdone',readout.finish);
      document.removeEventListener('visibilitychange',policyChanged);
      reduced.removeEventListener('change',policyChanged);
      contrast.removeEventListener('change',policyChanged);
      connection?.removeEventListener('change',policyChanged);
      element.removeAttribute('data-display-paused');
    };
  },{scope:root,dependencies:[key],revertOnUpdate:true});
}
