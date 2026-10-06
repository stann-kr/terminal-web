'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AccessDraft = {
  code: string;
  fields: { name: string; email: string; instagram: string; privacyConsent: boolean; marketingConsent: boolean };
};
const EMPTY_DRAFT: AccessDraft = {
  code: '',
  fields: { name: '', email: '', instagram: '', privacyConsent: false, marketingConsent: false },
};
type Change = (previous: AccessDraft) => AccessDraft;
const DraftContext = createContext<{
  drafts: ReadonlyMap<string, AccessDraft>;
  update: (eventId: string, change: Change) => void;
} | null>(null);

/** Contact details live only in this mounted visit, never in storage or a server-wide cache. */
export function AccessDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, AccessDraft>>(() => new Map());
  const update = useCallback((eventId: string, change: Change) => {
    setDrafts(previous => {
      const current = previous.get(eventId) ?? EMPTY_DRAFT;
      const next = change(current);
      if (next === current) return previous;
      const updated = new Map(previous);
      if (next === EMPTY_DRAFT) updated.delete(eventId);
      else updated.set(eventId, next);
      return updated;
    });
  }, []);
  const value = useMemo(() => ({ drafts, update }), [drafts, update]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useAccessDraft(eventId: string) {
  const visit = useContext(DraftContext);
  // Standalone forms still work; only forms inside the visit provider survive being closed.
  const [local, setLocal] = useState(EMPTY_DRAFT);
  const draft = visit ? visit.drafts.get(eventId) ?? EMPTY_DRAFT : local;
  const update = (change: Change) => visit ? visit.update(eventId, change) : setLocal(change);
  return {
    draft,
    setCode: (code: string) => update(previous => ({ ...previous, code })),
    setFields: (fields: AccessDraft['fields']) => update(previous => ({ ...previous, fields })),
    // A response to an older submission must not erase a new draft written after returning.
    clear: (submitted: AccessDraft) => update(current => current === submitted ? EMPTY_DRAFT : current),
  };
}
