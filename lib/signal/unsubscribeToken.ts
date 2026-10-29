/**
 * The token in a mail's unsubscribe link: HMAC-SHA256 of the subscription id under a secret the
 * Worker and the mail script share (SIGNAL_UNSUBSCRIBE_SECRET). Old ids are partly a timestamp, so
 * the id alone could be guessed; the token cannot without the secret.
 */
const TOKEN = /^[0-9a-f]{64}$/;
const SUBSCRIPTION_ID = /^sig-[A-Za-z0-9-]{1,64}$/;

async function hmac(secret: string, id: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id)));
}

export async function signUnsubscribe(secret: string, id: string): Promise<string> {
  return [...await hmac(secret, id)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Whether `token` was signed for `id`, compared in constant time. */
export async function verifyUnsubscribe(secret: string, id: string, token: string): Promise<boolean> {
  if (!secret || !SUBSCRIPTION_ID.test(id) || !TOKEN.test(token)) return false;
  const expected = await signUnsubscribe(secret, id);
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  return diff === 0;
}
