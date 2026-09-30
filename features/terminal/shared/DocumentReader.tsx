'use client';

import { useRef } from 'react';
import type { Translate } from '../events/data';
import './reader.css';

/** Full source text stays available without expanding the dashboard's layout. */
export function DocumentReader({ title, paragraphs, label, t }: { title: string; paragraphs: string[]; label?: string; t: Translate }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!paragraphs.length) return null;
  return <>
    <button ref={trigger} type="button" className="tm-text-link tm-reader-trigger" onClick={() => dialog.current?.showModal()}>{label ?? t('전체 소개 읽기', 'Read full introduction')} ↗</button>
    <dialog ref={dialog} className="tm-reader" aria-label={title} onClose={() => trigger.current?.focus({ preventScroll: true })}>
      <header><div><p className="tm-eyebrow">SOURCE DOCUMENT</p><h2>{title}</h2></div><button type="button" className="tm-button" autoFocus onClick={() => dialog.current?.close()}>{t('닫기', 'Close')} ×</button></header>
      <div className="tm-reader-copy">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </dialog>
  </>;
}
