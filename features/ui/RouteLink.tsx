'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';
import { holdRoute } from './useRouteHold';

export { ROUTE_HOLD_MS } from './useRouteHold';

/**
 * A site link whose move waits ROUTE_HOLD_MS after the press, fetching the view in the meantime
 * (holdRoute). A second press on the same link does not start it again; a press on another link
 * takes over. If the address changed some other way while it waited (Escape, the back button), it
 * stays put. Buttons and keys that move take the same way through useRouteHold.
 */
export default function RouteLink({ href, replace, scroll, onNavigate, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={event => {
        onNavigate?.(event);
        event.preventDefault();
        holdRoute(router, href, { replace: !!replace, scroll });
      }}
    />
  );
}
