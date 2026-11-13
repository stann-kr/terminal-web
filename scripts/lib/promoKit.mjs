/**
 * The part of scripts/promo-kit.mjs that decides whether what the bucket holds is a manifest.
 * Nothing here runs on import or touches the bucket.
 */

/**
 * The manifest an object of the bucket holds. A stored object that is not one (JSON `null`, a
 * list, a manifest missing its parts) throws: it exists, so it is never taken for an event that
 * has no manifest yet and written over.
 * @param {string} content the object's text
 * @returns {{ dir: string, artists: Record<string, unknown[]>, event: unknown[] }}
 */
export function storedManifest(content) {
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('the stored manifest is not JSON');
  }
  const plain = (item) => typeof item === 'object' && item !== null && !Array.isArray(item);
  if (!plain(value)) throw new Error('the stored manifest is not an object');
  if (typeof value.dir !== 'string' || !value.dir) throw new Error('the stored manifest has no dir');
  if (!plain(value.artists) || !Object.values(value.artists).every(Array.isArray)) throw new Error('the stored manifest has no artists lists');
  if (!Array.isArray(value.event)) throw new Error('the stored manifest has no event list');
  return value;
}
