/**
 * The parts of scripts/transmit-remove.mjs that decide what a run may do. Nothing here runs on
 * import or touches a database.
 */

export const DATABASE = 'terminal-db';
export const ID = /^[A-Za-z0-9_-]{1,160}$/;
export const COLUMNS = ['id', 'handle', 'message', 'ts', 'created_at', 'device_id'];
export const USAGE = 'usage: transmit:remove -- list [count] [--remote] | remove <id> [--remote --confirm <id>] | restore <backup.json> [--remote --confirm <post id>]';

/**
 * @typedef {{ command?: string, target?: string, remote: boolean, persistTo: string | null, confirm: string | null, error?: string }} TransmitArgs
 */

/**
 * Reads the command line: `<command> [target]` with --remote, --persist-to <dir> and --confirm <id>.
 * @param {string[]} args
 * @returns {TransmitArgs}
 */
export function parseArgs(args) {
  /** @type {TransmitArgs} */
  const parsed = { remote: false, persistTo: null, confirm: null };
  /** @type {string[]} */
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--remote') parsed.remote = true;
    else if (arg === '--persist-to' || arg === '--confirm') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) return { ...parsed, error: `${arg} needs a value` };
      if (arg === '--persist-to') parsed.persistTo = value;
      else parsed.confirm = value;
      index += 1;
    } else if (arg.startsWith('--')) return { ...parsed, error: `unknown option ${arg}` };
    else positional.push(arg);
  }
  [parsed.command, parsed.target] = positional;
  if (positional.length > 2) return { ...parsed, error: `unexpected argument ${positional[2]}` };
  if (parsed.remote && parsed.persistTo) return { ...parsed, error: '--persist-to is for the local simulation only' };
  return parsed;
}

/**
 * Whether a remove or restore of the post `id` may write. The local simulation always may; the live
 * database only when --confirm names that same post id. Otherwise the run prints `plan` and stops.
 * @param {{ action: 'remove' | 'restore', id: string, remote: boolean, confirm: string | null, backup?: string }} input
 * @returns {{ write: true } | { write: false, plan: string }}
 */
export function writeDecision({ action, id, remote, confirm, backup }) {
  if (!remote || confirm === id) return { write: true };
  const what = action === 'remove'
    ? `would take ${id} down from the live log (backing it up first)`
    : `would put ${id} back into the live log from ${backup ?? 'the backup'}`;
  const mismatch = confirm === null ? '' : ` (--confirm ${confirm} does not name this post)`;
  return { write: false, plan: `dry run: ${what}${mismatch}. To do it, run again with --remote --confirm ${id}.` };
}

/**
 * Why a backup cannot be restored where this run points, or null when it can: it must hold a post
 * of this database, taken from the same place (live or local) as the run targets.
 * @param {unknown} backup
 * @param {{ remote: boolean, database?: string }} target
 * @returns {string | null}
 */
export function backupMismatch(backup, { remote, database = DATABASE }) {
  const saved = /** @type {{ database?: unknown, remote?: unknown, row?: { id?: unknown } } | null} */ (backup);
  if (!saved || typeof saved !== 'object' || !saved.row || typeof saved.row.id !== 'string' || !ID.test(saved.row.id)) return 'the file holds no post';
  if (saved.database !== database) return `the backup is of database ${String(saved.database)}, not ${database}`;
  if (typeof saved.remote !== 'boolean') return 'the backup does not say whether it came from the live or the local log';
  if (saved.remote !== remote) {
    const from = saved.remote ? 'live' : 'local';
    const to = remote ? 'live' : 'local';
    return `the backup was taken from the ${from} log; this run targets the ${to} log (${saved.remote ? 'add' : 'drop'} --remote)`;
  }
  return null;
}

/** SQL text literal: the value is quoted and its quotes doubled; NULL stays NULL. */
export const literal = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);

/**
 * The INSERT that puts a backed-up post back.
 * @param {Record<string, unknown>} row
 */
export const restoreSql = (row) => `INSERT INTO transmit_logs (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((column) => literal(row[column])).join(', ')});\n`;
