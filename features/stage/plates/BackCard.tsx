import { BrandText } from '@/features/ui/Ui';
import type { StageData } from '../data';
import type { PlateId, StageState } from '../state';
import { CardLink } from './faces';
import styles from './plates.module.css';

const PLATE_NAME: Record<PlateId, [string, string]> = {
  next: ['NEXT', '다음 행사'],
  events: ['EVENTS', '이벤트'],
  artists: ['ARTISTS', '아티스트'],
  log: ['LOG', '방문자 로그'],
  signal: ['SIGNAL', '소식 신청'],
  about: ['ABOUT', 'TERMINAL 소개'],
};

/** A view's printed name and title, as the back card shows it. */
function describe(state: StageState, data: StageData): [string, string] {
  switch (state.view) {
    case 'plate': {
      const [name, title] = PLATE_NAME[state.plate];
      return [state.page > 1 ? `${name} · ${String(state.page).padStart(2, '0')}` : name, title];
    }
    case 'session':
      return [state.request ? 'ACCESS' : 'SESSION', data.ordered.find(event => event.id === state.eventId)?.session ?? state.eventId];
    case 'artist':
      return ['ARTIST', data.profiles.find(profile => profile.key === state.artistKey)?.name ?? '아티스트'];
    default:
      return ['HOME', '홈'];
  }
}

/** The way back: a card naming the view it returns to. Escape does the same. */
export function BackCard({ href, target, data }: { href: string; target: StageState; data: StageData }) {
  const [name, title] = describe(target, data);
  return (
    <CardLink href={href} className={styles.back} label={`이전 화면으로: ${title}`}>
      <span className={styles.backHead} aria-hidden="true">
        <span className={styles.backLabel}>BACK</span>
        <span className={styles.tag}>ESC</span>
      </span>
      <span className={styles.backName} aria-hidden="true">{name}</span>
      <span className={styles.backTitle} aria-hidden="true"><BrandText text={title} /></span>
    </CardLink>
  );
}
