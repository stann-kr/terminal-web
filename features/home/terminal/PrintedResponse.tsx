'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './terminal.module.css';

// Persist the complete response separately; only a new command gets a print pass.
export function PrintedResponse({ id, text, error, mode, onComplete, onPrint }: {
  id: number; text: string; error?: boolean; mode: 'waiting'|'printing'|'done';
  onComplete: (id?: number) => void; onPrint: () => void;
}) {
  const [printed,setPrinted] = useState('');
  const root = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (mode !== 'printing') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = window.matchMedia?.('(forced-colors: active)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false, index = 0, buffer = '';
    const stop = () => { stopped = true; clearTimeout(timer); };
    const finish = (all = false) => { stop(); onComplete(all ? undefined : id); };
    const disabled = () => reduced?.matches || contrast?.matches || connection?.saveData || document.visibilityState === 'hidden' || !!root.current?.closest('[data-effects-off],[data-display-paused]');
    const policyChanged = () => { if (disabled()) finish(true); };
    const characters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text),part => part.segment)
      : Array.from(text);
    const print = () => {
      if (stopped) return;
      if (disabled()) { finish(true); return; }
      if (index >= characters.length) { finish(); return; }
      const character = characters[index++];
      buffer += character; setPrinted(buffer);
      timer = setTimeout(print,character === '\n' ? 90 : 16);
    };
    const observer = new MutationObserver(policyChanged);
    for (let parent = root.current?.parentElement; parent; parent = parent.parentElement) observer.observe(parent,{attributes:true,attributeFilter:['data-effects-off','data-display-paused']});
    reduced?.addEventListener('change',policyChanged);
    contrast?.addEventListener('change',policyChanged);
    connection?.addEventListener('change',policyChanged);
    document.addEventListener('visibilitychange',policyChanged);
    if (disabled()) finish(true); else timer = setTimeout(print,16);
    return () => {
      stop(); observer.disconnect();
      reduced?.removeEventListener('change',policyChanged);
      contrast?.removeEventListener('change',policyChanged);
      connection?.removeEventListener('change',policyChanged);
      document.removeEventListener('visibilitychange',policyChanged);
    };
  },[id,text,mode,onComplete]);
  useLayoutEffect(() => { onPrint(); },[printed,mode,onPrint]);
  return <pre ref={root} data-error={error || undefined}>
    <span className={styles.label}>{text}</span>
    <span aria-hidden="true" data-printing={mode === 'printing'} className={styles.printed}>{mode === 'done' ? text : printed}</span>
  </pre>;
}
