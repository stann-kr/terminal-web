/** The query key an invite link carries its code in: `/events/<id>/request?invite=<code>`. */
export const INVITE_PARAM = 'invite';
const MAX_INVITE_LENGTH = 64;

/** The code an invite link carries, or null when the address has none (or an unusable one). */
export function inviteCodeFrom(search: string): string | null {
  const code = new URLSearchParams(search).get(INVITE_PARAM)?.trim();
  return code && code.length <= MAX_INVITE_LENGTH ? code : null;
}

/** The address a guest code holder shares: the request form opens with the code already checked. */
export function inviteHref(eventId: string, code: string): string {
  return `/events/${encodeURIComponent(eventId)}/request?${new URLSearchParams({ [INVITE_PARAM]: code })}`;
}
