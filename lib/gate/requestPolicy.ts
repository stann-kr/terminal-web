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

/** The most minutes before its start an event may stop taking guest requests (a day). */
export const MAX_ACCESS_CLOSE_MINUTES = 1_440;

/**
 * How many minutes before its start an event stops taking guest requests: its own
 * `accessCloseMinutes` when that is a whole number from 0 to MAX_ACCESS_CLOSE_MINUTES, otherwise 0
 * (requests run until the start). The gate, the host page and the pages read it through here.
 */
export function accessCloseMinutes(event: { accessCloseMinutes?: unknown }): number {
  const minutes = event.accessCloseMinutes;
  return typeof minutes === 'number' && Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= MAX_ACCESS_CLOSE_MINUTES
    ? minutes
    : 0;
}
