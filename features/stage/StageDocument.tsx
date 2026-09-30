'use client';
import { useEffect, type ReactNode } from 'react';
import { useOptionalStageRoute } from './StageRoute';

/**
 * Route-boundary content (an error screen) that must be seen whatever the URL maps to: while
 * mounted, the stage folds every plate into the rail and shows this in the document area.
 */
export function StageDocument({ children }: { children: ReactNode }) {
  const claim = useOptionalStageRoute()?.claimDocument;
  useEffect(() => claim?.(), [claim]);
  return <div data-stage-document="">{children}</div>;
}
