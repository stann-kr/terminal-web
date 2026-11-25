import { countMailStat } from '@/lib/mail/statRoute';

/** A transparent 1×1 GIF. */
const PIXEL = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));

/**
 * GET /api/mail/open?k=<mail key>&s=<signature> — the open pixel of a Signal mail (lib/mail/stats).
 * Always answers the image, never cached, so each load reaches the Worker; only a signed one counts.
 * No rate limit: Gmail loads every reader's images from the same proxy addresses.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  await countMailStat('open', params.get('k') ?? '', '', params.get('s') ?? '');
  return new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
      'Content-Length': String(PIXEL.byteLength),
    },
  });
}
