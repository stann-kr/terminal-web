import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { envValue, failureReason, maskEmails, parseWranglerJson, readEnvValue } from '../scripts/lib/cli.mjs';
import { startServer } from '../promo/serve.mjs';

describe('.env values', () => {
  it('takes one pair of surrounding quotes off', () => {
    expect(envValue('KEY="quoted value"\n', 'KEY')).toBe('quoted value');
    expect(envValue("KEY='single'\n", 'KEY')).toBe('single');
    expect(envValue('KEY=plain\n', 'KEY')).toBe('plain');
    expect(envValue('KEY="unbalanced\n', 'KEY')).toBe('"unbalanced');
    expect(envValue('export KEY = spaced \r\nOTHER=x', 'KEY')).toBe('spaced');
  });

  it('does not read another key that starts the same way, and treats empty as unset', () => {
    expect(envValue('KEY_OTHER=x\nKEY=\n', 'KEY')).toBeUndefined();
    expect(envValue('# KEY=x\n', 'KEY')).toBeUndefined();
  });

  it('prefers the environment, reads .env otherwise, and treats a missing .env as unset', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ops-env-'));
    try {
      const file = path.join(dir, '.env');
      await writeFile(file, 'SECRET="from-file"\n');
      expect(readEnvValue('SECRET', { env: { SECRET: 'from-env' }, file })).toBe('from-env');
      expect(readEnvValue('SECRET', { env: {}, file })).toBe('from-file');
      expect(readEnvValue('SECRET', { env: {}, file: path.join(dir, 'missing.env') })).toBeUndefined();
      // A .env that exists but cannot be read is an error, not "unset".
      expect(() => readEnvValue('SECRET', { env: {}, file: dir })).toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('failure messages', () => {
  it('shows the error line, with addresses masked', () => {
    expect(failureReason({ stderr: 'log\n✘ [ERROR] cannot send to a@example.com\n' })).toBe('✘ [ERROR] cannot send to <email>');
  });

  it('shows the end of the output when no line names an error', () => {
    expect(failureReason({ stderr: 'one\ntwo\nthree\nfour to b@example.com\n' })).toBe('two / three / four to <email>');
    expect(failureReason({ stderr: '' , message: '' })).not.toBe('');
  });

  it('masks every address', () => {
    expect(maskEmails('<a@example.com>, b.c+d@example.co.kr')).toBe('<<email>>, <email>');
  });
});

describe('wrangler JSON output', () => {
  it('reads the result array, past a banner', () => {
    expect(parseWranglerJson('[{"results":[{"id":"x"}]}]')).toEqual([{ results: [{ id: 'x' }] }]);
    expect(parseWranglerJson('▲ [WARNING] something\n[\n  {"results":[]}\n]\n')).toEqual([{ results: [] }]);
  });

  it('throws a readable error when there is no array', () => {
    expect(() => parseWranglerJson('✘ [ERROR] not logged in')).toThrow(/no JSON result/);
    expect(() => parseWranglerJson('')).toThrow(/no JSON result/);
  });
});

describe('promo kit server', () => {
  const get = (port: number, pathname: string) =>
    new Promise<number>((resolve, reject) => {
      request({ host: '127.0.0.1', port, path: pathname }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      }).on('error', reject).end();
    });

  it('answers a malformed path with 400 and keeps serving', async () => {
    const server = await startServer({ port: 0, host: '127.0.0.1' });
    try {
      const { port } = server.address() as AddressInfo;
      expect(await get(port, '/%E0%A4%A')).toBe(400);
      expect(await get(port, '//')).toBe(400);
      expect(await get(port, '/fonts/%')).toBe(400);
      expect(await get(port, '/no-such-file.png')).toBe(404);
      expect(await get(port, '/')).toBe(200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
