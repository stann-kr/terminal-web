import * as React from 'react';
import type { ReactNode } from 'react';

type ViewTransitionProps = { name: string; share: string; default: 'none'; children: ReactNode };
// React's ViewTransition ships in the App Router's React build; stable builds (tests) lack it.
const ViewTransition = (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> })
  .ViewTransition;

/**
 * Names an element that persists across a page change, so the browser carries it from its old
 * place to its new one. `kind` picks the motion: `morph` for a record growing into its file
 * plate, `slide` for the header's gold tab. Names must be unique on a page.
 */
export function Morph({ name, kind = 'morph', children }: { name: string; kind?: 'morph' | 'slide'; children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition name={name} share={kind} default="none">
      {children}
    </ViewTransition>
  );
}
