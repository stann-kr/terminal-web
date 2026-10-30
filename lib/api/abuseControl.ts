import { isJsonObject, isString } from '@/lib/api/validation';

export type ProtectedAction = 'code-info' | 'gate-request' | 'host' | 'signal' | 'transmit';

export interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface AbuseControlEnv {
  PUBLIC_RATE_LIMITER?: RateLimitBinding;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
}

export type AbuseDecision =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: 'RATE_LIMITED' | 'ABUSE_CONTROL_UNAVAILABLE' };

export interface TurnstileValidationInput {
  token: string;
  secret: string;
  expectedAction: ProtectedAction;
  expectedHostname: string;
  remoteIp?: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type TurnstileDecision =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'unavailable' };

export function createAttemptKey(action: ProtectedAction, request: Request): string {
  const actor = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'anonymous';
  const budget = action === 'code-info' || action === 'gate-request' ? 'gate' : action;
  return `${budget}:${actor.slice(0, 128)}`;
}

export async function enforceRateLimit(
  env: AbuseControlEnv,
  action: ProtectedAction,
  request: Request,
): Promise<AbuseDecision> {
  const limiter = env.PUBLIC_RATE_LIMITER;
  if (!limiter) return { ok: true };

  try {
    const { success } = await limiter.limit({ key: createAttemptKey(action, request) });
    return success ? { ok: true } : { ok: false, status: 429, error: 'RATE_LIMITED' };
  } catch {
    return { ok: false, status: 503, error: 'ABUSE_CONTROL_UNAVAILABLE' };
  }
}

function parseTurnstileResponse(value: unknown): {
  success: boolean;
  action?: string;
  hostname?: string;
} | null {
  if (!isJsonObject(value) || typeof value.success !== 'boolean') return null;
  if (value.action !== undefined && !isString(value.action)) return null;
  if (value.hostname !== undefined && !isString(value.hostname)) return null;
  return { success: value.success, action: value.action, hostname: value.hostname };
}

export async function validateTurnstile({
  token,
  secret,
  expectedAction,
  expectedHostname,
  remoteIp,
  idempotencyKey,
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: TurnstileValidationInput): Promise<TurnstileDecision> {
  if (!token || token.length > 2_048 || !secret || !expectedHostname || !idempotencyKey) {
    return { ok: false, reason: 'invalid' };
  }

  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  body.set('idempotency_key', idempotencyKey);
  if (remoteIp) body.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body, signal: controller.signal },
    );
    if (!response.ok) return { ok: false, reason: 'unavailable' };

    const result = parseTurnstileResponse(await response.json());
    if (!result) return { ok: false, reason: 'unavailable' };
    return result.success
      && result.action === expectedAction
      && result.hostname === expectedHostname
      ? { ok: true }
      : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
