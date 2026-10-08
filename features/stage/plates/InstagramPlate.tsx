'use client';
import { instagram } from '@/features/about/instagram';
import { Chip } from '@/features/ui/Ui';
import { FitTitle } from '../FitTitle';
import { CardLink, ChipFace } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

// The name starts with the printed name, so a voice command that reads the card finds it.
const label = `Instagram ${instagram.handle} 팔로우, 새 탭에서 열기`;

/** The Instagram account: the signal card's face (big name, one line, tags); it opens the profile in a new tab. */
export function InstagramPlate({ mode }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace external href={instagram.url} name="INSTAGRAM" title={instagram.printed} label={label} />;
  return (
    <CardLink external href={instagram.url} className={styles.signalCard} label={label}>
      <span className={`${styles.signalHead} ${styles.wideHead}`} aria-hidden="true">INSTAGRAM</span>
      {/* One line, set down to fit a narrow column (a handle has no place to break). */}
      <FitTitle as="span" text={instagram.printed} maxLines={1} minPx={12} className={styles.signalText} />
      <span className={styles.bandTags} aria-hidden="true">
        <Chip>FOLLOW</Chip>
      </span>
    </CardLink>
  );
}
