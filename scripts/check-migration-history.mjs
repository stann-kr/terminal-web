import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const scriptPath = fileURLToPath(import.meta.url);

export const PROJECT_ROOT = path.resolve(path.dirname(scriptPath), "..");
export const DEFAULT_MIGRATIONS_DIR = path.join(PROJECT_ROOT, "migrations");
export const DEFAULT_LOCK_PATH = path.join(
  PROJECT_ROOT,
  "scripts",
  "migration-history.lock.json",
);

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const SQL_FILE_PATTERN = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const SNAPSHOT_FILE_PATTERN = /^(\d{4})_snapshot\.json$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/**
 * @typedef {object} MigrationLockFile
 * @property {string} path
 * @property {string} sha256
 */

/**
 * @typedef {object} MigrationLockManifest
 * @property {number} version
 * @property {string} algorithm
 * @property {MigrationLockFile[]} files
 */

/**
 * @typedef {object} CheckMigrationHistoryOptions
 * @property {string} [migrationsDir]
 * @property {string} [repoRoot]
 * @property {string} [lockPath]
 * @property {MigrationLockManifest} [lockManifest]
 */

export class MigrationHistoryError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationHistoryError";
  }
}

function fail(message) {
  throw new MigrationHistoryError(message);
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

async function readJson(filePath, label) {
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(`${label} is missing: ${filePath}`);
    }
    throw error;
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    fail(`${label} is not valid JSON: ${filePath} (${error.message})`);
  }
}

async function readDirectory(directoryPath, label) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(`${label} is missing: ${directoryPath}`);
    }
    throw error;
  }
}

function toRepositoryPath(repoRoot, filePath) {
  const relativePath = path.relative(repoRoot, filePath);

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    fail(`migration file is outside the repository root: ${filePath}`);
  }

  return relativePath.split(path.sep).join("/");
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object`);
  }
}

export async function inspectMigrationHistory({
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  repoRoot = PROJECT_ROOT,
} = {}) {
  const resolvedMigrationsDir = path.resolve(migrationsDir);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const rootEntries = await readDirectory(
    resolvedMigrationsDir,
    "migrations directory",
  );
  const sqlFiles = [];
  let hasMetaDirectory = false;

  for (const entry of rootEntries) {
    if (entry.name === "meta" && entry.isDirectory()) {
      hasMetaDirectory = true;
      continue;
    }

    if (!entry.isFile()) {
      fail(`unexpected entry in migrations/: ${entry.name}`);
    }

    const match = SQL_FILE_PATTERN.exec(entry.name);
    if (!match) {
      fail(
        `migration SQL file must use ####_safe_name.sql: ${entry.name}`,
      );
    }

    sqlFiles.push({
      fileName: entry.name,
      filePath: path.join(resolvedMigrationsDir, entry.name),
      prefix: match[1],
      prefixNumber: Number(match[1]),
      tag: entry.name.slice(0, -4),
    });
  }

  if (!hasMetaDirectory) {
    fail(`migration metadata directory is missing: ${path.join(resolvedMigrationsDir, "meta")}`);
  }

  sqlFiles.sort((left, right) => compareStrings(left.fileName, right.fileName));

  if (sqlFiles.length === 0) {
    fail("migration history must contain at least 0000");
  }

  const seenPrefixes = new Set();
  for (const [index, migration] of sqlFiles.entries()) {
    if (seenPrefixes.has(migration.prefix)) {
      fail(`duplicate migration prefix: ${migration.prefix}`);
    }
    seenPrefixes.add(migration.prefix);

    const expectedPrefix = String(index).padStart(4, "0");
    if (
      migration.prefix !== expectedPrefix ||
      migration.prefixNumber !== index
    ) {
      fail(
        `migration prefixes must be continuous from 0000: expected ${expectedPrefix}, found ${migration.prefix}`,
      );
    }
  }

  const metaDir = path.join(resolvedMigrationsDir, "meta");
  const metaEntries = await readDirectory(metaDir, "migration metadata directory");
  const snapshotFiles = [];
  let hasJournal = false;

  for (const entry of metaEntries) {
    if (!entry.isFile()) {
      fail(`unexpected entry in migrations/meta/: ${entry.name}`);
    }

    if (entry.name === "_journal.json") {
      hasJournal = true;
      continue;
    }

    const match = SNAPSHOT_FILE_PATTERN.exec(entry.name);
    if (!match) {
      fail(`unexpected migration metadata file: meta/${entry.name}`);
    }

    snapshotFiles.push({
      fileName: entry.name,
      filePath: path.join(metaDir, entry.name),
      prefix: match[1],
    });
  }

  if (!hasJournal) {
    fail(`migration journal is missing: ${path.join(metaDir, "_journal.json")}`);
  }

  snapshotFiles.sort((left, right) =>
    compareStrings(left.fileName, right.fileName),
  );

  const journalPath = path.join(metaDir, "_journal.json");
  const journal = await readJson(journalPath, "migration journal");
  assertObject(journal, "migration journal");

  if (journal.dialect !== "sqlite") {
    fail(`migration journal dialect must be sqlite, found ${String(journal.dialect)}`);
  }
  if (!Array.isArray(journal.entries)) {
    fail("migration journal entries must be an array");
  }
  if (journal.entries.length !== sqlFiles.length) {
    fail(
      `migration journal must match SQL 1:1: ${journal.entries.length} entries for ${sqlFiles.length} SQL files`,
    );
  }

  for (const [index, migration] of sqlFiles.entries()) {
    const entry = journal.entries[index];
    assertObject(entry, `migration journal entry ${index}`);

    if (entry.idx !== index) {
      fail(
        `migration journal idx must be continuous: expected ${index}, found ${String(entry.idx)}`,
      );
    }
    if (entry.tag !== migration.tag) {
      fail(
        `migration journal tag mismatch at ${migration.prefix}: expected ${migration.tag}, found ${String(entry.tag)}`,
      );
    }
  }

  if (snapshotFiles.length !== sqlFiles.length) {
    fail(
      `migration snapshots must match SQL 1:1: ${snapshotFiles.length} snapshots for ${sqlFiles.length} SQL files`,
    );
  }

  const seenSnapshotIds = new Set();
  let expectedPrevId = ZERO_UUID;

  for (const [index, migration] of sqlFiles.entries()) {
    const snapshotFile = snapshotFiles[index];

    if (!snapshotFile || snapshotFile.prefix !== migration.prefix) {
      fail(
        `migration snapshot mismatch at ${migration.prefix}: expected meta/${migration.prefix}_snapshot.json`,
      );
    }

    const snapshot = await readJson(
      snapshotFile.filePath,
      `migration snapshot ${snapshotFile.prefix}`,
    );
    assertObject(snapshot, `migration snapshot ${snapshotFile.prefix}`);

    if (snapshot.dialect !== "sqlite") {
      fail(
        `migration snapshot ${snapshotFile.prefix} dialect must be sqlite, found ${String(snapshot.dialect)}`,
      );
    }
    if (typeof snapshot.id !== "string" || !UUID_PATTERN.test(snapshot.id)) {
      fail(`migration snapshot ${snapshotFile.prefix} has an invalid id`);
    }
    if (seenSnapshotIds.has(snapshot.id)) {
      fail(`duplicate migration snapshot id: ${snapshot.id}`);
    }
    if (snapshot.prevId !== expectedPrevId) {
      fail(
        `migration snapshot ${snapshotFile.prefix} prevId mismatch: expected ${expectedPrevId}, found ${String(snapshot.prevId)}`,
      );
    }

    seenSnapshotIds.add(snapshot.id);
    expectedPrevId = snapshot.id;
    migration.snapshotPath = snapshotFile.filePath;
    migration.snapshotId = snapshot.id;
  }

  return {
    journalPath,
    migrations: sqlFiles,
    migrationsDir: resolvedMigrationsDir,
    repoRoot: resolvedRepoRoot,
    trackedFiles: [
      ...sqlFiles.map((migration) => migration.filePath),
      journalPath,
      ...snapshotFiles.map((snapshot) => snapshot.filePath),
    ],
  };
}

export async function createMigrationLockManifest(
  history,
  { repoRoot = history.repoRoot ?? PROJECT_ROOT } = {},
) {
  const files = await Promise.all(
    history.trackedFiles.map(async (filePath) => ({
      path: toRepositoryPath(path.resolve(repoRoot), filePath),
      sha256: await sha256(filePath),
    })),
  );

  files.sort((left, right) => compareStrings(left.path, right.path));

  return {
    version: 1,
    algorithm: "sha256",
    files,
  };
}

function validateLockShape(lockManifest) {
  assertObject(lockManifest, "migration history lock");

  if (lockManifest.version !== 1) {
    fail(
      `migration history lock version must be 1, found ${String(lockManifest.version)}`,
    );
  }
  if (lockManifest.algorithm !== "sha256") {
    fail(
      `migration history lock algorithm must be sha256, found ${String(lockManifest.algorithm)}`,
    );
  }
  if (!Array.isArray(lockManifest.files)) {
    fail("migration history lock files must be an array");
  }

  const seenPaths = new Set();
  let previousPath = null;

  for (const [index, file] of lockManifest.files.entries()) {
    assertObject(file, `migration history lock file ${index}`);

    if (
      typeof file.path !== "string" ||
      file.path.length === 0 ||
      path.posix.isAbsolute(file.path) ||
      file.path === ".." ||
      file.path.startsWith("../") ||
      file.path.includes("\\")
    ) {
      fail(`migration history lock file ${index} has an unsafe path`);
    }
    if (seenPaths.has(file.path)) {
      fail(`duplicate path in migration history lock: ${file.path}`);
    }
    if (previousPath !== null && compareStrings(previousPath, file.path) >= 0) {
      fail("migration history lock files must be sorted by path");
    }
    if (typeof file.sha256 !== "string" || !SHA256_PATTERN.test(file.sha256)) {
      fail(`migration history lock file ${file.path} has an invalid SHA-256`);
    }

    seenPaths.add(file.path);
    previousPath = file.path;
  }
}

export async function verifyMigrationLock(
  history,
  lockManifest,
  { repoRoot = history.repoRoot ?? PROJECT_ROOT } = {},
) {
  validateLockShape(lockManifest);

  const currentManifest = await createMigrationLockManifest(history, { repoRoot });
  const lockedFiles = new Map(
    lockManifest.files.map((file) => [file.path, file.sha256]),
  );
  const currentFiles = new Map(
    currentManifest.files.map((file) => [file.path, file.sha256]),
  );
  const additions = currentManifest.files
    .filter((file) => !lockedFiles.has(file.path))
    .map((file) => file.path);
  const deletions = lockManifest.files
    .filter((file) => !currentFiles.has(file.path))
    .map((file) => file.path);
  const overwrites = currentManifest.files
    .filter(
      (file) =>
        lockedFiles.has(file.path) && lockedFiles.get(file.path) !== file.sha256,
    )
    .map((file) => file.path);

  if (additions.length || deletions.length || overwrites.length) {
    const details = [
      additions.length ? `added: ${additions.join(", ")}` : null,
      deletions.length ? `deleted: ${deletions.join(", ")}` : null,
      overwrites.length ? `overwritten: ${overwrites.join(", ")}` : null,
    ].filter(Boolean);

    fail(`migration history lock mismatch (${details.join("; ")})`);
  }

  return currentManifest;
}

async function git(repoRoot, args) {
  const { stdout } = await runFile("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function gitFailure(error) {
  const stderr = error?.stderr ? String(error.stderr).trim() : "";
  return stderr.split("\n")[0] || error?.message || String(error);
}

/**
 * Compares the history with a base commit: every migration SQL file and snapshot that commit holds
 * must still be here, byte for byte. The lock cannot see this on its own, because one change can
 * rewrite a migration and its lock entry together. The journal is left out: it grows with every new
 * migration, and the structure check already ties its tags to the SQL files.
 *
 * @param {{ migrationsDir: string, repoRoot?: string }} history
 * @param {string} baseRef a commit the repository already has (fetch it first)
 * @param {{ repoRoot?: string }} [options]
 * @returns {Promise<string[]>} the repository paths that were compared
 */
export async function verifyMigrationsAgainstBase(
  history,
  baseRef,
  { repoRoot = history.repoRoot ?? PROJECT_ROOT } = {},
) {
  if (typeof baseRef !== "string" || baseRef.length === 0 || baseRef.startsWith("-")) {
    fail(`base commit is not a usable ref: ${String(baseRef)}`);
  }

  const resolvedRepoRoot = path.resolve(repoRoot);
  const directory = toRepositoryPath(resolvedRepoRoot, history.migrationsDir);
  let listing;

  try {
    listing = await git(resolvedRepoRoot, [
      "ls-tree",
      "-r",
      "-z",
      "--name-only",
      baseRef,
      "--",
      directory,
    ]);
  } catch (error) {
    fail(
      `cannot read migrations at the base commit ${baseRef} (${gitFailure(error)}). Fetch the base branch first`,
    );
  }

  const basePaths = listing
    .toString("utf8")
    .split("\0")
    .filter((filePath) => {
      const folder = path.posix.dirname(filePath);
      const name = path.posix.basename(filePath);
      return (
        (folder === directory && SQL_FILE_PATTERN.test(name)) ||
        (folder === `${directory}/meta` && SNAPSHOT_FILE_PATTERN.test(name))
      );
    })
    .sort(compareStrings);
  const deletions = [];
  const overwrites = [];

  for (const filePath of basePaths) {
    const before = await git(resolvedRepoRoot, ["cat-file", "blob", `${baseRef}:${filePath}`]);
    let now;

    try {
      now = await readFile(path.join(resolvedRepoRoot, ...filePath.split("/")));
    } catch (error) {
      if (error?.code === "ENOENT") {
        deletions.push(filePath);
        continue;
      }
      throw error;
    }

    if (!before.equals(now)) overwrites.push(filePath);
  }

  if (deletions.length || overwrites.length) {
    const details = [
      deletions.length ? `deleted: ${deletions.join(", ")}` : null,
      overwrites.length ? `overwritten: ${overwrites.join(", ")}` : null,
    ].filter(Boolean);

    fail(
      `migration history changed since ${baseRef} (${details.join("; ")}). A migration the base branch already has is never edited: add a new one with npm run db:generate -- --name <safe_name>`,
    );
  }

  return basePaths;
}

/**
 * @param {CheckMigrationHistoryOptions} [options]
 */
export async function checkMigrationHistory({
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  repoRoot = PROJECT_ROOT,
  lockPath = DEFAULT_LOCK_PATH,
  lockManifest,
} = {}) {
  const history = await inspectMigrationHistory({ migrationsDir, repoRoot });
  let resolvedLockManifest = lockManifest;

  if (resolvedLockManifest === undefined) {
    try {
      resolvedLockManifest = await readJson(
        path.resolve(lockPath),
        "migration history lock",
      );
    } catch (error) {
      if (
        error instanceof MigrationHistoryError &&
        error.message.startsWith("migration history lock is missing:")
      ) {
        fail(
          `${error.message}. After reviewing a fully reconciled history, create the initial lock with npm run db:lock-history`,
        );
      }
      throw error;
    }
  }

  const manifest = await verifyMigrationLock(history, resolvedLockManifest, {
    repoRoot,
  });

  return { history, manifest };
}

export async function writeMigrationLockManifest(
  lockPath,
  manifest,
  { overwrite = true } = {},
) {
  validateLockShape(manifest);

  const resolvedLockPath = path.resolve(lockPath);
  const directory = path.dirname(resolvedLockPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(resolvedLockPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });

  try {
    if (overwrite) {
      await rename(temporaryPath, resolvedLockPath);
    } else {
      try {
        await link(temporaryPath, resolvedLockPath);
      } catch (error) {
        if (error?.code === "EEXIST") {
          fail(
            `migration history lock already exists: ${resolvedLockPath}. Use npm run db:generate -- --name <safe_name> to advance it`,
          );
        }
        throw error;
      }
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function parseCliArguments(argv) {
  const options = {
    baseRef: undefined,
    lockPath: DEFAULT_LOCK_PATH,
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
    repoRoot: PROJECT_ROOT,
    writeLock: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--write-lock") {
      options.writeLock = true;
      continue;
    }

    if (argument === "--base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        fail("--base requires a commit or ref");
      }
      index += 1;
      options.baseRef = value;
      continue;
    }

    if (["--lock", "--migrations-dir", "--repo-root"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        fail(`${argument} requires a path`);
      }
      index += 1;

      if (argument === "--lock") options.lockPath = path.resolve(value);
      if (argument === "--migrations-dir") {
        options.migrationsDir = path.resolve(value);
      }
      if (argument === "--repo-root") options.repoRoot = path.resolve(value);
      continue;
    }

    fail(`unsupported argument: ${argument}`);
  }

  return options;
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));

  if (options.writeLock) {
    if (options.baseRef !== undefined) fail("--base is a check: it cannot be combined with --write-lock");
    const history = await inspectMigrationHistory(options);
    const manifest = await createMigrationLockManifest(history, options);
    await writeMigrationLockManifest(options.lockPath, manifest, {
      overwrite: false,
    });
    console.log(
      `Migration history lock created for ${history.migrations.length} migrations: ${options.lockPath}`,
    );
    return;
  }

  const { history } = await checkMigrationHistory(options);
  console.log(
    `Migration history OK: ${history.migrations.length} continuous SQL/journal/snapshot entries match the lock`,
  );

  if (options.baseRef !== undefined) {
    const compared = await verifyMigrationsAgainstBase(history, options.baseRef, options);
    console.log(
      `Migration history OK: ${compared.length} SQL and snapshot files are unchanged since ${options.baseRef}`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`Migration history check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
