import { getCloudflareContext } from '@opennextjs/cloudflare';
import { readJsonBody } from '@/lib/api/guards';
import { enforceRateLimit } from '@/lib/api/abuseControl';
import { noStoreJson } from '@/lib/api/responses';
import { safeLogError } from '@/lib/api/safeLog';
import { getDb } from '@/lib/db/client';
import {
  createTransmitLog,
  listTransmitLogs,
} from '@/lib/transmit/d1TransmitRepository';
import { createTransmitRecord } from '@/lib/transmit/domain';
import { parseIdempotencyKey } from '@/lib/transmit/idempotency';
import {
  parseTransmitPage,
  parseTransmitSubmission,
} from '@/lib/transmit/input';

export async function GET(request: Request) {
  try {
    const page = parseTransmitPage(new URL(request.url).searchParams.get('page'));
    if (page === null) return noStoreJson({ error: 'INVALID_PAGE' }, 400);

    const { env } = await getCloudflareContext({ async: true });
    const logPage = await listTransmitLogs(getDb(env.DB), page);
    return noStoreJson(logPage);
  } catch (error) {
    safeLogError('transmit.list_failed', { error });
    return noStoreJson({ error: 'INTERNAL_SERVER_ERROR' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request, 8_192);
    if (!parsedBody.ok) return parsedBody.response;

    const parsedInput = parseTransmitSubmission(
      parsedBody.body,
      parseIdempotencyKey(request.headers.get('idempotency-key')),
    );
    if (!parsedInput.ok) return noStoreJson({ error: parsedInput.error }, 400);

    const { env } = await getCloudflareContext({ async: true });
    const abuseDecision = await enforceRateLimit(env, 'transmit', request);
    if (!abuseDecision.ok) {
      return noStoreJson({ error: abuseDecision.error }, abuseDecision.status);
    }

    const result = await createTransmitLog(
      getDb(env.DB),
      createTransmitRecord(parsedInput.input, new Date()),
    );
    if (result.status === 'conflict') {
      return noStoreJson({ error: 'IDEMPOTENCY_CONFLICT' }, 409);
    }
    return noStoreJson(result.log, result.status === 'created' ? 201 : 200);
  } catch (error) {
    safeLogError('transmit.create_failed', { error });
    return noStoreJson({ error: 'INTERNAL_SERVER_ERROR' }, 500);
  }
}
