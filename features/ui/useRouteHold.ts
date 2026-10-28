'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { markPending, navigatingTo } from '@/features/shell/useConsoleMotion';

type Router = ReturnType<typeof useRouter>;

/**
 * Shortest time a move within the site shows its loading cover (useNavigationPending), so a fast
 * line still reads as the press taken rather than the view jumping at once. Short on purpose:
 * every move pays it.
 */
export const ROUTE_HOLD_MS = 350;

/** The move waiting out its hold. */
let held: { href: string; timer: number } | null = null;

/**
 * Moves to `href` after ROUTE_HOLD_MS, fetching the view in the meantime. A second call for the same
 * place while it waits does not start it again; a call for another place takes over. If the address
 * changed some other way while it waited (Escape, the back button), it stays put. Every site move
 * goes through here (RouteLink, and the keys and buttons of useRouteHold), so one takes over another.
 */
export function holdRoute(router: Router, href: string, { replace = false, scroll }: { replace?: boolean; scroll?: boolean } = {}) {
  if (held?.href === href) return;
  if (held) window.clearTimeout(held.timer);
  const from = window.location.href;
  // A full prefetch: a detail is dynamic, and the default would fetch only its shell.
  router.prefetch(href, { kind: 'full' } as Parameters<Router['prefetch']>[1]);
  held = {
    href,
    timer: window.setTimeout(() => {
      held = null;
      if (window.location.href !== from) return;
      (replace ? router.replace : router.push)(href, { scroll: scroll ?? true });
    }, ROUTE_HOLD_MS),
  };
}

/** Whether a move to `href` is waiting out its hold, or has been taken and not arrived (markPending). */
const onItsWay = (href: string) => held?.href === href || navigatingTo() === href;

/** On screen to carry the cover: not detached, hidden, invisible or faded out (a Box put away). */
const shown = (control: HTMLElement) =>
  control.isConnected && (control.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true);

/**
 * A move started by a button or a key rather than a link: the same hold as RouteLink, and the same
 * loading cover, shown on `control` (the button pressed, or the key's on-screen counterpart). With no
 * control on screen the move still holds, with no cover. A repeat while the move is on its way (a
 * second press, a held-down key) does nothing.
 */
export function useRouteHold() {
  const router = useRouter();
  return useCallback(
    (href: string, { control, replace, scroll }: { control?: HTMLElement | null; replace?: boolean; scroll?: boolean } = {}) => {
      if (onItsWay(href)) return;
      markPending(control && shown(control) ? control : null, href);
      holdRoute(router, href, { replace, scroll });
    },
    [router],
  );
}
