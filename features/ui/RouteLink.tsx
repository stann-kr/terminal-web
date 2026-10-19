'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * Shortest time a move within the site shows its loading cover (useNavigationPending), so a fast
 * line still reads as the press taken rather than the view jumping at once. Short on purpose:
 * every move pays it.
 */
export const ROUTE_HOLD_MS = 350;

let held: { href: string; timer: number } | null = null;

/**
 * A site link whose move waits ROUTE_HOLD_MS after the press, fetching the view in the meantime.
 * A second press on the same link does not start it again; a press on another link takes over.
 * If the address changed some other way while it waited (Escape, the back button), it stays put.
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
        if (held?.href === href) return;
        if (held) window.clearTimeout(held.timer);
        const from = window.location.href;
        // A full prefetch: a detail is dynamic, and the default would fetch only its shell.
        router.prefetch(href, { kind: 'full' } as Parameters<typeof router.prefetch>[1]);
        held = {
          href,
          timer: window.setTimeout(() => {
            held = null;
            if (window.location.href !== from) return;
            (replace ? router.replace : router.push)(href, { scroll: scroll ?? true });
          }, ROUTE_HOLD_MS),
        };
      }}
    />
  );
}
