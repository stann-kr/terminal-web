import { sessionShort } from '@/features/events/model';
import { Arrow, BrandText } from '@/features/ui/Ui';
import type { StageData } from '../data';
import type { PlateId, StageState } from '../state';
import { CardLink } from './faces';
import styles from './plates.module.css';

const PLATE_NAME: Record<PlateId, [string, string]> = {
  next: ['NEXT', '다음 이벤트'],
  events: ['EVENTS', '이벤트'],
  artists: ['ARTISTS', '아티스트'],
  log: ['LOG', '방문자 로그'],
  signal: ['SIGNAL', '소식 신청'],
  instagram: ['INSTAGRAM', '팔로우'],
  about: ['ABOUT', 'TERMINAL 소개'],
  merch: ['MERCH', 'TERMINAL MERCH'],
};

/** A view's printed name and title, as the back card shows it. */
function describe(state: StageState, data: StageData): [string, string] {
  switch (state.view) {
    case 'plate': {
      const [name, title] = PLATE_NAME[state.plate];
      return [state.page > 1 ? `${name} · ${String(state.page).padStart(2, '0')}` : name, title];
    }
    case 'session':
      return [state.request ? 'ACCESS' : 'SESSION', sessionShort(data.ordered.find(event => event.id === state.eventId)?.session ?? state.eventId)];
    case 'artist':
      return ['ARTIST', data.profiles.find(profile => profile.key === state.artistKey)?.name ?? '아티스트'];
    default:
      return ['HOME', '홈'];
  }
}

/**
 * The way back: a card naming the view it returns to (Escape does the same). BACK and ESC on a
 * small line, the view's name and its Korean title under it; on a phone it is one low bar, BACK on
 * the left and the name on the right.
 */
export function BackCard({ href, target, data }: { href: string; target: StageState; data: StageData }) {
  const [name, title] = describe(target, data);
  return (
    <CardLink href={href} className={styles.back} label={`이전 화면으로: ${title}`}>
      <span className={styles.backHead} aria-hidden="true">
        <span className={styles.backLabel}>BACK</span>
        <span className={styles.backEsc}>ESC</span>
      </span>
      <span className={styles.backTo}>
        <span className={styles.backName}>{name}<Arrow /></span>
        <span className={styles.backTitle}><BrandText text={title} /></span>
      </span>
    </CardLink>
  );
}

/** The band's last key: straight home, however far the visit has wandered, in the home's own colour. */
export function HomeKey() {
  return (
    <CardLink href="/" className={styles.homeKey} label="홈으로" surface="feature">
      <span className={styles.homeName} aria-hidden="true">HOME<Arrow /></span>
    </CardLink>
  );
}
