/**
 * The promo files an artist can take from their host page: 2x exports from the design canvas in the
 * private R2 bucket `terminal-press` (keys `trm-03/<name>.png` and `<name>.thumb.jpg`). Each artist
 * gets their own poster faces and the event's posters and teasers, nothing of another artist's.
 * Names carry a content hash, so a replaced export never meets a stale copy.
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

const DIR = 'trm-03';
const file = (label: string, name: string, base: string, width: number, height: number, bytes: number): PromoFile => ({
  label,
  download: `TERMINAL[03]_${base}.png`,
  key: `${DIR}/${name}.png`,
  thumbKey: `${DIR}/${name}.thumb.jpg`,
  width,
  height,
  bytes,
});

const ARTIST_FILES: Record<string, PromoFile[]> = {
  '03-A': [
    file('아티스트 포스터 · 앞면', 'stannlumo-front.6659998d7ca4', 'stannlumo_front', 2160, 2880, 7109352),
    file('아티스트 포스터 · 뒷면', 'stannlumo-back.28660e54091e', 'stannlumo_back', 2160, 2880, 1484675),
  ],
  '03-B': [
    file('아티스트 포스터 · 앞면', 'hogun-front.0596ca9196b0', 'hogun_front', 2160, 2880, 7014508),
    file('아티스트 포스터 · 뒷면', 'hogun-back.449d58e8762b', 'hogun_back', 2160, 2880, 1512242),
  ],
  '03-C': [
    file('아티스트 포스터 · 앞면', 'kimboyeon-front.8a313b8ee570', 'kimboyeon_front', 2160, 2880, 6732326),
    file('아티스트 포스터 · 뒷면', 'kimboyeon-back.b40ac4d60941', 'kimboyeon_back', 2160, 2880, 1423027),
  ],
  '03-D': [
    file('아티스트 포스터 · 앞면', 'minjoon-front.f78c3cb1bf78', 'minjoon_front', 2160, 2880, 6474322),
    file('아티스트 포스터 · 뒷면', 'minjoon-back.812f26e05119', 'minjoon_back', 2160, 2880, 1512316),
  ],
  '03-E': [
    file('아티스트 포스터 · 앞면', 'yaree-front.a4e2851ed6da', 'yaree_front', 2160, 2880, 6840322),
    file('아티스트 포스터 · 뒷면', 'yaree-back.5f0dcadc9f92', 'yaree_back', 2160, 2880, 1496542),
  ],
  '03-F': [
    file('아티스트 포스터 · 앞면', 'harim-front.5675ba06d88c', 'harim_front', 2160, 2880, 6547876),
    file('아티스트 포스터 · 뒷면', 'harim-back.b22a12c8b9f9', 'harim_back', 2160, 2880, 1386282),
  ],
};

const EVENT_FILES: Record<string, PromoFile[]> = {
  'TRM-03': [
    file('본 포스터', 'main.9cb197280f1b', 'main', 2160, 2880, 2375449),
    file('본 포스터 · 스토리', 'main-story.181231053d65', 'main_story', 2160, 3840, 2562724),
    file('타임테이블 · 스토리', 'timetable-story.bf6024eaf402', 'timetable_story', 2160, 3840, 468457),
    file('티저', 'teaser.af058b046376', 'teaser', 2160, 2880, 5952827),
    file('프리티저', 'preteaser.1988830cfc25', 'preteaser', 2160, 2880, 2571669),
  ],
};

/** The artist's own posters first, then the event's. */
export function promoKit(eventId: string, artistId: string): PromoFile[] {
  return [...(ARTIST_FILES[artistId] ?? []), ...(EVENT_FILES[eventId] ?? [])];
}

/** Whether `key` is one of the files this artist may take (the full file or its preview). */
export function promoFileFor(eventId: string, artistId: string, key: string): PromoFile | null {
  return promoKit(eventId, artistId).find((item) => item.key === key || item.thumbKey === key) ?? null;
}
