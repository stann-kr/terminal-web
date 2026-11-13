/**
 * The promo files an artist can take from their host page: 2x exports from the design canvas in the
 * private R2 bucket `terminal-press`. Which files there are lives in the bucket too, as one manifest
 * per event (`kit/<eventId>.json`, written by `npm run kit`), so adding or replacing a poster is an
 * upload, never a deploy. Each artist gets their own poster faces and the event's files, nothing of
 * another artist's. Names carry a content hash, so a replaced export never meets a stale copy.
 */
export interface PromoFile {
  label: string;
  /** Saved under this name. */
  download: string;
  /** R2 keys of the full file and its small preview. */
  key: string;
  thumbKey: string;
  width: number;
  height: number;
  bytes: number;
}

/** One entry as the manifest stores it: `<dir>/<name>.png` and `<dir>/<name>.thumb.jpg`. */
interface ManifestEntry {
  label: string;
  name: string;
  download: string;
  width: number;
  height: number;
  bytes: number;
}

interface Manifest {
  dir: string;
  artists: Record<string, ManifestEntry[]>;
  event: ManifestEntry[];
}

type PressBucket = Pick<R2Bucket, 'get'>;

export const manifestKey = (eventId: string) => `kit/${eventId}.json`;

const SAFE = /^[A-Za-z0-9._\[\]-]+$/;
const isEntry = (value: unknown): value is ManifestEntry => {
  const entry = value as ManifestEntry;
  return typeof entry === 'object' && entry !== null
    && typeof entry.label === 'string'
    && typeof entry.name === 'string' && SAFE.test(entry.name)
    && typeof entry.download === 'string' && SAFE.test(entry.download)
    && [entry.width, entry.height, entry.bytes].every((n) => Number.isInteger(n) && n > 0);
};
const entries = (value: unknown) => (Array.isArray(value) ? value.filter(isEntry) : []);

async function readManifest(bucket: PressBucket | undefined, eventId: string): Promise<Manifest | null> {
  const object = await bucket?.get(manifestKey(eventId));
  if (!object) return null;
  const raw = (await object.json()) as Partial<Manifest>;
  if (typeof raw?.dir !== 'string' || !SAFE.test(raw.dir)) return null;
  const artists = typeof raw.artists === 'object' && raw.artists !== null ? raw.artists : {};
  return {
    dir: raw.dir,
    artists: Object.fromEntries(Object.entries(artists).map(([id, list]) => [id, entries(list)])),
    event: entries(raw.event),
  };
}

const toFile = (dir: string) => ({ name, ...entry }: ManifestEntry): PromoFile => ({
  ...entry,
  key: `${dir}/${name}.png`,
  thumbKey: `${dir}/${name}.thumb.jpg`,
});

/** The artist's own posters first, then the event's; none when the event has no manifest. */
export async function promoKit(bucket: PressBucket | undefined, eventId: string, artistId: string): Promise<PromoFile[]> {
  const manifest = await readManifest(bucket, eventId);
  if (!manifest) return [];
  return [...(manifest.artists[artistId] ?? []), ...manifest.event].map(toFile(manifest.dir));
}

/** Whether `key` is one of the files this artist may take (the full file or its preview). */
export async function promoFileFor(bucket: PressBucket | undefined, eventId: string, artistId: string, key: string): Promise<PromoFile | null> {
  return (await promoKit(bucket, eventId, artistId)).find((item) => item.key === key || item.thumbKey === key) ?? null;
}
