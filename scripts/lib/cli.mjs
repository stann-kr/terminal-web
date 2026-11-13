import { readFileSync } from 'node:fs';

/**
 * Small pieces the operation scripts (signal-mail, artist-invite, transmit-remove, promo-kit) share.
 * Nothing here runs on import.
 */

const EMAIL_LIKE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g;

/** The text with every email address replaced, so an error message can be shown or logged. */
export const maskEmails = (text) => String(text).replace(EMAIL_LIKE, '<email>');

/**
 * What went wrong in a failed command: its first line that names an error, else the last few lines
 * of its output. Email addresses are masked either way.
 * @param {unknown} error
 * @returns {string}
 */
export function failureReason(error) {
  const failure = /** @type {{ stderr?: unknown, stdout?: unknown, message?: unknown } | null | undefined} */ (error);
  const output = String(failure?.stderr || failure?.message || error);
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  const named = lines.find((line) => /error|✘/i.test(line));
  const shown = named ?? (lines.slice(-3).join(' / ') || 'failed with no output');
  return maskEmails(shown).slice(0, 400);
}

/**
 * The arguments that are neither a flag nor the value of a flag that takes one.
 * @param {string[]} args
 * @param {string[]} valueFlags
 * @returns {string[]}
 */
export function positionalArgs(args, valueFlags) {
  return args.filter((arg, index) => !arg.startsWith('--') && !valueFlags.includes(args[index - 1]));
}

/**
 * The value of KEY in a .env text, with one pair of surrounding quotes taken off.
 * @param {string} text
 * @param {string} key
 * @returns {string | undefined}
 */
export function envValue(text, key) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match || match[1] !== key) continue;
    let value = match[2].trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
    return value || undefined;
  }
  return undefined;
}

/**
 * KEY from the environment, else from the .env file. A missing .env reads as unset; any other read
 * error is thrown.
 * @param {string} key
 * @param {{ env?: Record<string, string | undefined>, file?: string }} [options]
 * @returns {string | undefined}
 */
export function readEnvValue(key, { env = process.env, file = '.env' } = {}) {
  if (env[key] !== undefined) return env[key];
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error)?.code === 'ENOENT') return undefined;
    throw error;
  }
  return envValue(text, key);
}

/**
 * The JSON array `wrangler d1 execute --json` prints (one result per statement). Anything printed
 * before the array is skipped; output with no readable array throws an Error that says so.
 * @param {string} output
 * @returns {Array<{ results?: Array<Record<string, unknown>>, meta?: Record<string, unknown> }>}
 */
export function parseWranglerJson(output) {
  const text = String(output);
  const starts = [0, ...[...text.matchAll(/^\s*\[/gm)].map((match) => match.index ?? 0)];
  for (const start of starts) {
    try {
      const parsed = JSON.parse(text.slice(start));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not the array yet: try the next line that opens one.
    }
  }
  throw new Error(`wrangler printed no JSON result (${maskEmails(text.trim().slice(0, 120)) || 'no output'})`);
}
