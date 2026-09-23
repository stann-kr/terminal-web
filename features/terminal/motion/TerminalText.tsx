'use client';

import { Wordmark } from '../shared/Wordmark';

/** Canonical text owns layout/accessibility; only the decorative output changes. */
export function TerminalText({ children, afterglow = false }: { children: string; afterglow?: boolean }) {
  return <span className="tm-terminal-text"><span data-readout-source><Wordmark text={children} /></span><span data-readout-output="" aria-hidden="true" />{afterglow && <span data-readout-ghost aria-hidden="true" />}</span>;
}
