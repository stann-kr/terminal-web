'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react';
import { stageStateFromUrl, type StageState } from './state';

/** A navigation the stage has already started showing while the route payload is on its way. */
type Pending = { from: string; to: string; state: StageState | null };

export interface StageRoute {
  /** What the stage shows: the pending target while a click travels, otherwise the URL. */
  state: StageState | null;
  /** The URL-owned state; the final truth once a navigation commits. */
  committed: StageState | null;
  pathname: string;
  pending: boolean;
  /** Pushes a route and shows its stage state at once (Esc, keys). */
  navigate: (href: string) => void;
  /** Error boundaries take the document area over while they are mounted. */
  documentTakeover: boolean;
  claimDocument: () => () => void;
}

const StageRouteContext = createContext<StageRoute | null>(null);

export function useStageRoute(): StageRoute {
  const route = useContext(StageRouteContext);
  if (!route) throw new Error('useStageRoute must be used inside the stage route provider.');
  return route;
}

/** Optional read for components that also render outside the stage (error pages in tests). */
export const useOptionalStageRoute = () => useContext(StageRouteContext);

export const StageRouteProvider = StageRouteContext.Provider;

const PENDING_LIMIT = 8000;
const urlKey = (pathname: string, search: string) => (search ? `${pathname}?${search}` : pathname);

/**
 * Owns the stage's route state. The URL is the truth; a plain click on a client-side link shows
 * its target immediately so plates start moving before the route payload arrives. The pending
 * state only applies while the committed URL is still the one it started from, so a commit,
 * a redirect, a back/forward jump, a newer click or a stalled request can never leave it stuck.
 */
export function useStageRouteController() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const query = search.toString();
  const committedKey = urlKey(pathname, query);
  const committed = useMemo(() => stageStateFromUrl(pathname, new URLSearchParams(query)), [pathname, query]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [claims, setClaims] = useState(0);
  const active = pending && pending.from === committedKey ? pending : null;

  const begin = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    const to = urlKey(url.pathname, url.searchParams.toString());
    const state = stageStateFromUrl(url.pathname, url.searchParams);
    // Redirects and unknown routes stay put until the route boundary answers.
    if (to === committedKey || !state) return false;
    setPending({ from: committedKey, to, state });
    return true;
  }, [committedKey]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setPending(null), PENDING_LIMIT);
    const cancel = () => setPending(null);
    window.addEventListener('popstate', cancel);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', cancel);
    };
  }, [active]);

  const navigate = useCallback((href: string) => {
    begin(href);
    router.push(href);
  }, [begin, router]);

  /** Bubble-phase click: `next/link` has already prevented the default for a client navigation. */
  const onClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    begin(anchor.href);
  }, [begin]);

  const claimDocument = useCallback(() => {
    setClaims(count => count + 1);
    return () => setClaims(count => count - 1);
  }, []);

  const route = useMemo<StageRoute>(() => ({
    state: active ? active.state : committed,
    committed,
    pathname,
    pending: !!active,
    navigate,
    documentTakeover: claims > 0,
    claimDocument,
  }), [active, committed, pathname, navigate, claims, claimDocument]);

  return { route, onClick };
}
