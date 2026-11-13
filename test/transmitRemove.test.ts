import { describe, expect, it } from 'vitest';

import { backupMismatch, parseArgs, restoreSql, writeDecision } from '../scripts/lib/transmitRemove.mjs';

describe('transmit-remove arguments', () => {
  it('reads the command, target and flags in any order', () => {
    expect(parseArgs(['remove', 'post-1', '--remote', '--confirm', 'post-1'])).toEqual({
      command: 'remove', target: 'post-1', remote: true, persistTo: null, confirm: 'post-1',
    });
    expect(parseArgs(['--persist-to', '/tmp/sim', 'list', '5'])).toMatchObject({ command: 'list', target: '5', remote: false, persistTo: '/tmp/sim' });
  });

  it('refuses a flag without its value, an unknown flag and --persist-to with --remote', () => {
    expect(parseArgs(['remove', 'post-1', '--remote', '--confirm']).error).toMatch(/--confirm needs a value/);
    expect(parseArgs(['remove', 'post-1', '--confirm', '--remote']).error).toMatch(/--confirm needs a value/);
    expect(parseArgs(['remove', 'post-1', '--remtoe']).error).toMatch(/unknown option/);
    expect(parseArgs(['list', '--remote', '--persist-to', '/tmp/sim']).error).toMatch(/local simulation only/);
    expect(parseArgs(['remove', 'a', 'b']).error).toMatch(/unexpected argument b/);
  });
});

describe('transmit-remove write decision', () => {
  it('only plans a live remove or restore without --confirm', () => {
    const remove = writeDecision({ action: 'remove', id: 'post-1', remote: true, confirm: null });
    expect(remove).toMatchObject({ write: false });
    expect(remove.write === false && remove.plan).toContain('--remote --confirm post-1');
    const restore = writeDecision({ action: 'restore', id: 'post-1', remote: true, confirm: null, backup: 'b.json' });
    expect(restore).toMatchObject({ write: false });
    expect(restore.write === false && restore.plan).toContain('b.json');
  });

  it('only plans when --confirm names another post', () => {
    const decision = writeDecision({ action: 'remove', id: 'post-1', remote: true, confirm: 'post-2' });
    expect(decision).toMatchObject({ write: false });
    expect(decision.write === false && decision.plan).toContain('does not name this post');
  });

  it('writes live only when --confirm names the post, and always locally', () => {
    expect(writeDecision({ action: 'remove', id: 'post-1', remote: true, confirm: 'post-1' })).toEqual({ write: true });
    expect(writeDecision({ action: 'restore', id: 'post-1', remote: false, confirm: null })).toEqual({ write: true });
  });
});

describe('transmit-remove restore target', () => {
  const row = { id: 'post-1', handle: 'h', message: "it's", ts: 't', created_at: 'c', device_id: null };

  it('accepts a backup restored where it was taken', () => {
    expect(backupMismatch({ database: 'terminal-db', remote: true, row }, { remote: true })).toBeNull();
    expect(backupMismatch({ database: 'terminal-db', remote: false, row }, { remote: false })).toBeNull();
  });

  it('refuses a backup taken from the other place', () => {
    expect(backupMismatch({ database: 'terminal-db', remote: false, row }, { remote: true })).toMatch(/local log; this run targets the live log/);
    expect(backupMismatch({ database: 'terminal-db', remote: true, row }, { remote: false })).toMatch(/live log; this run targets the local log/);
  });

  it('refuses a backup that does not say where it came from, or of another database, or with no post', () => {
    expect(backupMismatch({ database: 'terminal-db', row }, { remote: true })).toMatch(/does not say/);
    expect(backupMismatch({ database: 'other-db', remote: true, row }, { remote: true })).toMatch(/database other-db/);
    expect(backupMismatch({ database: 'terminal-db', remote: true, row: { id: "x'; DROP" } }, { remote: true })).toMatch(/no post/);
    expect(backupMismatch(null, { remote: true })).toMatch(/no post/);
  });

  it('quotes every value of the restored row', () => {
    expect(restoreSql(row)).toBe("INSERT INTO transmit_logs (id, handle, message, ts, created_at, device_id) VALUES ('post-1', 'h', 'it''s', 't', 'c', NULL);\n");
  });
});
