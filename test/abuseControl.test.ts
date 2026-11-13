import { describe, expect, it, vi } from 'vitest';
import {
  createAttemptKey,
  enforceRateLimit,
  validateTurnstile,
  type RateLimitBinding,
} from '../lib/api/abuseControl';

describe('public abuse-control contracts', () => {
  it('shares one actor budget between code verification and gate submission', () => {
    const request = new Request('https://terminal.test/api/gate', {
      headers: { 'cf-connecting-ip': '192.0.2.1' },
    });
    expect(createAttemptKey('code-info', request)).toBe('gate:192.0.2.1');
    expect(createAttemptKey('gate-request', request)).toBe('gate:192.0.2.1');
    expect(createAttemptKey('signal', request)).toBe('signal:192.0.2.1');
    // A host page's previews never use up the attempts its own actions need.
    expect(createAttemptKey('host-file', request)).not.toBe(createAttemptKey('host', request));
  });

  it('allows local execution without a production binding', async () => {
    const request = new Request('https://terminal.test/api/signal');
    await expect(enforceRateLimit({}, 'signal', request)).resolves.toEqual({ ok: true });
  });

  it('returns a bounded failure for exhausted and unavailable bindings', async () => {
    const request = new Request('https://terminal.test/api/signal', {
      headers: { 'cf-connecting-ip': '192.0.2.1' },
    });
    const exhausted: RateLimitBinding = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const unavailable: RateLimitBinding = { limit: vi.fn().mockRejectedValue(new Error('offline')) };

    await expect(enforceRateLimit({ PUBLIC_RATE_LIMITER: exhausted }, 'signal', request)).resolves.toEqual({
      ok: false, status: 429, error: 'RATE_LIMITED',
    });
    await expect(enforceRateLimit({ PUBLIC_RATE_LIMITER: unavailable }, 'signal', request)).resolves.toEqual({
      ok: false, status: 503, error: 'ABUSE_CONTROL_UNAVAILABLE',
    });
  });

  it('requires Turnstile action and hostname and sends an idempotency key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: 'signal',
      hostname: 'terminal.example',
    }), { status: 200 }));

    await expect(validateTurnstile({
      token: 'token',
      secret: 'secret',
      expectedAction: 'signal',
      expectedHostname: 'terminal.example',
      idempotencyKey: crypto.randomUUID(),
      fetchImpl,
    })).resolves.toEqual({ ok: true });

    const body = fetchImpl.mock.calls[0][1]?.body as FormData;
    expect(body.get('idempotency_key')).toBeTruthy();
    expect(body.get('secret')).toBe('secret');
  });

  it('fails closed on mismatch, timeout, replay, or malformed verification', async () => {
    const invalidFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      action: 'signal',
      hostname: 'terminal.example',
      'error-codes': ['timeout-or-duplicate'],
    }), { status: 200 }));
    const options = {
      token: 'token',
      secret: 'secret',
      expectedAction: 'signal' as const,
      expectedHostname: 'terminal.example',
      idempotencyKey: crypto.randomUUID(),
    };

    await expect(validateTurnstile({ ...options, fetchImpl: invalidFetch })).resolves.toEqual({
      ok: false, reason: 'invalid',
    });
    await expect(validateTurnstile({
      ...options,
      fetchImpl: vi.fn().mockRejectedValue(new Error('timeout')),
    })).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });
});
