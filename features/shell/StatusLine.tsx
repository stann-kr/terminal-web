'use client';
import Link from 'next/link';
import { DataActivity } from '@/features/display/Display';
import { useEvents } from '@/features/events/data';
import { eventHref } from '@/features/events/model';
import { artistHref, buildArtistArchive } from '@/features/artists/model';
import { PLATE_HREF, type PlateId, type StageState } from '@/features/stage/state';
import { Clock } from './Clock';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

const PLATE_NAME: Record<PlateId, [string, string]> = {
  next: ['NEXT', '다음 행사'],
  events: ['EVENTS', '이벤트'],
  artists: ['ARTISTS', '아티스트'],
  log: ['LOG', '방문자 로그'],
  signal: ['SIGNAL', '소식 신청'],
  about: ['ABOUT', '소개'],
};

type Crumb = { href: string; label: string; ko?: string };

/** Where you are, as links one level each: HOME / EVENTS / TRM-02. */
function useCrumbs(state: StageState): Crumb[] {
  const { events } = useEvents();
  const home: Crumb = { href: '/', label: 'HOME', ko: '홈' };
  const plate = (id: PlateId): Crumb => ({ href: PLATE_HREF[id], label: PLATE_NAME[id][0], ko: PLATE_NAME[id][1] });
  switch (state.view) {
    case 'home':
      return [home];
    case 'plate':
      return [home, plate(state.plate)];
    case 'session': {
      const crumbs = [home, plate('events'), { href: eventHref(state.eventId), label: state.eventId }];
      return state.request ? [...crumbs, { href: `${eventHref(state.eventId)}/request`, label: 'ACCESS', ko: '게스트 신청' }] : crumbs;
    }
    case 'artist': {
      const name = events ? buildArtistArchive(events).find(profile => profile.key === state.artistKey)?.name : undefined;
      return [home, plate('artists'), { href: artistHref(state.artistKey), label: name ?? 'FILE' }];
    }
    default:
      return [];
  }
}

/**
 * The status line over the stage: the wordmark (home), the path, and the console readouts. There
 * are no menu tabs: the plates themselves are the menu.
 */
export function StatusLine({ state }: { state: StageState }) {
  const { language, setLanguage } = useLanguage();
  const crumbs = useCrumbs(state);
  return (
    <header className={styles.top} data-surface="deep">
      <Link href="/" className={styles.brand} aria-label="TERMINAL 홈" scroll={false}>
        <span className={styles.brandMark}>TERMINAL</span>
      </Link>
      {crumbs.length > 0 ? (
        <nav className={styles.path} aria-label="경로">
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={crumb.href}>
                <Link href={crumb.href} aria-current={index === crumbs.length - 1 ? 'page' : undefined} scroll={false}>
                  <b>{crumb.label}</b>
                  {crumb.ko && <small>{crumb.ko}</small>}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : (
        <span />
      )}
      <div className={styles.system}>
        <DataActivity />
        <Clock />
        <div className={styles.language} role="group" aria-label="콘텐츠 언어">
          {(['ko', 'en'] as const).map(lang => (
            <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
