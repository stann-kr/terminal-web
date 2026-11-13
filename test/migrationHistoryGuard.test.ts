import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkMigrationHistory,
  createMigrationLockManifest,
  inspectMigrationHistory,
  verifyMigrationsAgainstBase,
  writeMigrationLockManifest,
} from '../scripts/check-migration-history.mjs';
import {
  generateMigration,
  parseMigrationName,
  validateGeneratedMigrationDelta,
} from '../scripts/generate-migration.mjs';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const SNAPSHOT_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

const temporaryRoots: string[] = [];

async function createTemporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-2-history-test-'));
  temporaryRoots.push(root);
  return root;
}

async function writeHistory(root: string, tags: string[]) {
  const migrationsDir = path.join(root, 'migrations');
  const metaDir = path.join(migrationsDir, 'meta');

  await rm(migrationsDir, { force: true, recursive: true });
  await mkdir(metaDir, { recursive: true });

  await Promise.all(
    tags.map((tag, index) =>
      writeFile(
        path.join(migrationsDir, `${tag}.sql`),
        `CREATE TABLE fixture_${index} (id TEXT PRIMARY KEY);\n`,
      ),
    ),
  );

  await writeFile(
    path.join(metaDir, '_journal.json'),
    `${JSON.stringify(
      {
        version: '7',
        dialect: 'sqlite',
        entries: tags.map((tag, index) => ({
          idx: index,
          version: '6',
          when: 1_700_000_000_000 + index,
          tag,
          breakpoints: true,
        })),
      },
      null,
      2,
    )}\n`,
  );

  await Promise.all(
    tags.map((_, index) =>
      writeFile(
        path.join(metaDir, `${String(index).padStart(4, '0')}_snapshot.json`),
        `${JSON.stringify(
          {
            version: '6',
            dialect: 'sqlite',
            id: SNAPSHOT_IDS[index],
            prevId: index === 0 ? ZERO_UUID : SNAPSHOT_IDS[index - 1],
            tables: {},
            enums: {},
            _meta: { schemas: {}, tables: {}, columns: {} },
            internal: { indexes: {} },
          },
          null,
          2,
        )}\n`,
      ),
    ),
  );

  return migrationsDir;
}

async function makeLockedFixture(tags = ['0000_initial', '0001_add_signal']) {
  const root = await createTemporaryRoot();
  const migrationsDir = await writeHistory(root, tags);
  const history = await inspectMigrationHistory({ migrationsDir, repoRoot: root });
  const manifest = await createMigrationLockManifest(history, { repoRoot: root });

  return { history, manifest, migrationsDir, root };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { force: true, recursive: true }),
    ),
  );
});

describe('migration history structure', () => {
  it('accepts continuous SQL, matching journal tags, snapshots, and an in-memory lock', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture();

    const result = await checkMigrationHistory({
      migrationsDir,
      repoRoot: root,
      lockManifest: manifest,
    });

    expect(result.history.migrations.map((migration) => migration.tag)).toEqual([
      '0000_initial',
      '0001_add_signal',
    ]);
  });

  it('reads a custom lock path', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture();
    const lockPath = path.join(root, 'custom-history.lock.json');
    await writeMigrationLockManifest(lockPath, manifest, { overwrite: false });

    await expect(
      checkMigrationHistory({ migrationsDir, repoRoot: root, lockPath }),
    ).resolves.toMatchObject({
      history: { migrations: [{ tag: '0000_initial' }, { tag: '0001_add_signal' }] },
    });
  });

  it('rejects duplicate or non-continuous SQL prefixes', async () => {
    const root = await createTemporaryRoot();
    const migrationsDir = await writeHistory(root, [
      '0000_initial',
      '0001_add_signal',
    ]);
    await writeFile(
      path.join(migrationsDir, '0001_duplicate.sql'),
      'SELECT 1;\n',
    );

    await expect(
      inspectMigrationHistory({ migrationsDir, repoRoot: root }),
    ).rejects.toThrow('duplicate migration prefix: 0001');

    await unlink(path.join(migrationsDir, '0001_duplicate.sql'));
    await renameMigration(
      path.join(migrationsDir, '0001_add_signal.sql'),
      path.join(migrationsDir, '0002_add_signal.sql'),
    );

    await expect(
      inspectMigrationHistory({ migrationsDir, repoRoot: root }),
    ).rejects.toThrow('expected 0001, found 0002');
  });

  it('rejects a journal tag that is not 1:1 with SQL', async () => {
    const { migrationsDir, root } = await makeLockedFixture();
    const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8'));
    journal.entries[1].tag = '0001_wrong_tag';
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    await expect(
      inspectMigrationHistory({ migrationsDir, repoRoot: root }),
    ).rejects.toThrow('migration journal tag mismatch');
  });

  it('rejects missing snapshots and a broken prevId chain', async () => {
    const { migrationsDir, root } = await makeLockedFixture();
    const secondSnapshotPath = path.join(
      migrationsDir,
      'meta',
      '0001_snapshot.json',
    );
    await unlink(secondSnapshotPath);

    await expect(
      inspectMigrationHistory({ migrationsDir, repoRoot: root }),
    ).rejects.toThrow('migration snapshots must match SQL 1:1');

    await writeHistory(root, ['0000_initial', '0001_add_signal']);
    const secondSnapshot = JSON.parse(
      await readFile(secondSnapshotPath, 'utf8'),
    );
    secondSnapshot.prevId = ZERO_UUID;
    await writeFile(
      secondSnapshotPath,
      `${JSON.stringify(secondSnapshot, null, 2)}\n`,
    );

    await expect(
      inspectMigrationHistory({ migrationsDir, repoRoot: root }),
    ).rejects.toThrow('migration snapshot 0001 prevId mismatch');
  });
});

describe('migration history lock', () => {
  it('detects an overwritten migration', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture();
    await writeFile(
      path.join(migrationsDir, '0001_add_signal.sql'),
      'CREATE TABLE overwritten (id TEXT);\n',
    );

    await expect(
      checkMigrationHistory({
        migrationsDir,
        repoRoot: root,
        lockManifest: manifest,
      }),
    ).rejects.toThrow('overwritten: migrations/0001_add_signal.sql');
  });

  it('detects added migration history files', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture([
      '0000_initial',
    ]);
    await writeHistory(root, ['0000_initial', '0001_add_signal']);

    await expect(
      checkMigrationHistory({
        migrationsDir,
        repoRoot: root,
        lockManifest: manifest,
      }),
    ).rejects.toThrow('added: migrations/0001_add_signal.sql');
  });

  it('detects deleted migration history files', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture();
    await writeHistory(root, ['0000_initial']);

    await expect(
      checkMigrationHistory({
        migrationsDir,
        repoRoot: root,
        lockManifest: manifest,
      }),
    ).rejects.toThrow('deleted: migrations/0001_add_signal.sql');
  });
});

/** Commits everything under root as the base the next change is compared with. */
function commitBase(root: string) {
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c', 'user.name=fixture',
        '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false',
        '-c', 'core.hooksPath=/dev/null',
        '-c', 'core.autocrlf=false',
        ...args,
      ],
      { cwd: root, stdio: 'pipe' },
    );
  git('init', '--quiet');
  git('add', '--all');
  git('commit', '--quiet', '--message', 'base');
}

describe('migration history against a base commit', () => {
  it('accepts a migration added after the base', async () => {
    const { root } = await makeLockedFixture();
    commitBase(root);
    const migrationsDir = await writeHistory(root, [
      '0000_initial',
      '0001_add_signal',
      '0002_add_waitlist',
    ]);
    const history = await inspectMigrationHistory({ migrationsDir, repoRoot: root });

    await expect(verifyMigrationsAgainstBase(history, 'HEAD', { repoRoot: root })).resolves.toEqual([
      'migrations/0000_initial.sql',
      'migrations/0001_add_signal.sql',
      'migrations/meta/0000_snapshot.json',
      'migrations/meta/0001_snapshot.json',
    ]);
  });

  it('rejects a migration rewritten together with its lock', async () => {
    const { migrationsDir, root } = await makeLockedFixture();
    commitBase(root);
    await writeFile(
      path.join(migrationsDir, '0000_initial.sql'),
      'CREATE TABLE rewritten (id TEXT);\n',
    );
    const history = await inspectMigrationHistory({ migrationsDir, repoRoot: root });
    const refreshedLock = await createMigrationLockManifest(history, { repoRoot: root });

    // The lock check alone is satisfied: both sides of it were changed.
    await expect(
      checkMigrationHistory({ migrationsDir, repoRoot: root, lockManifest: refreshedLock }),
    ).resolves.toBeDefined();
    await expect(verifyMigrationsAgainstBase(history, 'HEAD', { repoRoot: root })).rejects.toThrow(
      'overwritten: migrations/0000_initial.sql',
    );
  });

  it('rejects a snapshot or migration the base had that is gone', async () => {
    const { root } = await makeLockedFixture();
    commitBase(root);
    const migrationsDir = await writeHistory(root, ['0000_initial', '0001_renamed']);
    const history = await inspectMigrationHistory({ migrationsDir, repoRoot: root });

    await expect(verifyMigrationsAgainstBase(history, 'HEAD', { repoRoot: root })).rejects.toThrow(
      'deleted: migrations/0001_add_signal.sql',
    );
  });

  it('says so when the base commit is not there to compare with', async () => {
    const { history, root } = await makeLockedFixture();
    commitBase(root);

    await expect(
      verifyMigrationsAgainstBase(history, 'origin/missing', { repoRoot: root }),
    ).rejects.toThrow('cannot read migrations at the base commit origin/missing');
    await expect(
      verifyMigrationsAgainstBase(history, '--output=x', { repoRoot: root }),
    ).rejects.toThrow('base commit is not a usable ref');
  });
});

describe('guarded migration generation', () => {
  it('requires one safe explicit name', () => {
    expect(parseMigrationName(['--name', 'add_transmit_index'])).toBe(
      'add_transmit_index',
    );
    expect(() => parseMigrationName([])).toThrow('explicit --name is required');
    expect(() => parseMigrationName(['--name', '../unsafe'])).toThrow(
      'lowercase snake_case',
    );
    expect(() =>
      parseMigrationName(['--name', 'first', '--name', 'second']),
    ).toThrow('exactly once');
  });

  it('rejects changes outside the journal plus expected SQL and snapshot', () => {
    const before = new Map([
      ['0000_initial.sql', { sha256: 'before-sql' }],
      ['meta/0000_snapshot.json', { sha256: 'before-snapshot' }],
      ['meta/_journal.json', { sha256: 'before-journal' }],
    ]);
    const after = new Map([
      ['0000_initial.sql', { sha256: 'changed-sql' }],
      ['0001_add_signal.sql', { sha256: 'new-sql' }],
      ['meta/0000_snapshot.json', { sha256: 'before-snapshot' }],
      ['meta/0001_snapshot.json', { sha256: 'new-snapshot' }],
      ['meta/_journal.json', { sha256: 'changed-journal' }],
    ]);

    expect(() =>
      validateGeneratedMigrationDelta(before, after, '0001_add_signal'),
    ).toThrow('changed immutable files: 0000_initial.sql');
  });

  it('stages an allowed generation and advances the lock atomically', async () => {
    const { manifest, migrationsDir, root } = await makeLockedFixture([
      '0000_initial',
    ]);
    const lockPath = path.join(root, 'scripts', 'migration-history.lock.json');
    await writeMigrationLockManifest(lockPath, manifest, { overwrite: false });

    const tag = await generateMigration({
      name: 'add_signal',
      lockPath,
      migrationsDir,
      projectRoot: root,
      runGenerator: async ({ outDir, name }) => {
        const journalPath = path.join(outDir, 'meta', '_journal.json');
        const journal = JSON.parse(await readFile(journalPath, 'utf8'));
        journal.entries.push({
          idx: 1,
          version: '6',
          when: 1_700_000_000_001,
          tag: `0001_${name}`,
          breakpoints: true,
        });
        await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
        await writeFile(
          path.join(outDir, `0001_${name}.sql`),
          'CREATE TABLE signal (id TEXT PRIMARY KEY);\n',
        );
        await writeFile(
          path.join(outDir, 'meta', '0001_snapshot.json'),
          `${JSON.stringify(
            {
              version: '6',
              dialect: 'sqlite',
              id: SNAPSHOT_IDS[1],
              prevId: SNAPSHOT_IDS[0],
              tables: {},
              enums: {},
              _meta: { schemas: {}, tables: {}, columns: {} },
              internal: { indexes: {} },
            },
            null,
            2,
          )}\n`,
        );
      },
    });

    expect(tag).toBe('0001_add_signal');
    await expect(
      checkMigrationHistory({ migrationsDir, repoRoot: root, lockPath }),
    ).resolves.toMatchObject({
      history: { migrations: [{ tag: '0000_initial' }, { tag }] },
    });
  });
});

async function renameMigration(source: string, destination: string) {
  const contents = await readFile(source);
  await writeFile(destination, contents, { flag: 'wx' });
  await unlink(source);
}
