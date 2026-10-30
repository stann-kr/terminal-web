/** HMAC-SHA256 of `message` under `secret`, as lowercase hex (what `createHmac(...).digest('hex')` prints). */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...signature].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const HEX_TOKEN = /^[0-9a-f]{64}$/;

/** Whether `token` is the signature of `message`, compared in constant time. */
export async function verifyHmacHex(secret: string, message: string, token: string): Promise<boolean> {
  if (!secret || !HEX_TOKEN.test(token)) return false;
  const expected = await hmacHex(secret, message);
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  return diff === 0;
}
