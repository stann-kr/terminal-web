import { hmacHex, verifyHmacHex } from '../api/signature';

/**
 * The token in a mail's unsubscribe link: HMAC-SHA256 of the subscription id under a secret the
 * Worker and the mail script share (SIGNAL_UNSUBSCRIBE_SECRET). Old ids are partly a timestamp, so
 * the id alone could be guessed; the token cannot without the secret.
 */
const SUBSCRIPTION_ID = /^sig-[A-Za-z0-9-]{1,64}$/;

export function signUnsubscribe(secret: string, id: string): Promise<string> {
  return hmacHex(secret, id);
}

/** Whether `token` was signed for `id`, compared in constant time. */
export async function verifyUnsubscribe(secret: string, id: string, token: string): Promise<boolean> {
  return SUBSCRIPTION_ID.test(id) && verifyHmacHex(secret, id, token);
}
