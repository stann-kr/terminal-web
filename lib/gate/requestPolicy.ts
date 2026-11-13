export const ACCESS_WINDOW_DAYS = 30;
/** The farthest ahead of its night an event may open guest requests. */
export const MAX_ACCESS_WINDOW_DAYS = 120;

/**
 * How many days before its start an event takes guest requests: its own `accessWindowDays` when
 * that is a whole number of days from 1 to MAX_ACCESS_WINDOW_DAYS, otherwise ACCESS_WINDOW_DAYS.
 * The server gate and the pages read it through here, so both open on the same day.
 */
export function accessWindowDays(event: { accessWindowDays?: unknown }): number {
  const days = event.accessWindowDays;
  return typeof days === 'number' && Number.isSafeInteger(days) && days >= 1 && days <= MAX_ACCESS_WINDOW_DAYS
    ? days
    : ACCESS_WINDOW_DAYS;
}
