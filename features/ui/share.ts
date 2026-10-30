'use client';
import { useEffect, useState } from 'react';

export type ShareState = 'idle' | 'copied' | 'failed';

/**
 * An address handed on: `share` opens a phone's share sheet (a messenger, a DM), elsewhere `copy`
 * puts the link on the clipboard. The state says what happened for two seconds, then resets.
 */
export function useShareLink() {
  const [state, setState] = useState<ShareState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);
  async function copy(url: string) {
    try {
      await copyText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  async function share(url: string, title: string) {
    if (window.matchMedia?.('(pointer: coarse)').matches && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copy(url);
  }
  return { state, share, copy };
}

/** The clipboard API where the page is secure; elsewhere (a preview over plain http) the older copy command. */
export async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text);
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('copy refused');
}
