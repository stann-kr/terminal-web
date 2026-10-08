'use client';
import { instagram } from '@/features/about/instagram';
import { Chip } from '@/features/ui/Ui';
import { CardLink, ChipFace } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const label = `인스타그램 ${instagram.handle} 팔로우, 새 탭에서 열기`;

/** The Instagram account: the signal card's face (big name, one line, tags); it opens the profile in a new tab. */
export function InstagramPlate({ mode }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace external href={instagram.url} name="INSTAGRAM" title="팔로우" meta={instagram.handle} label={label} />;
  return (
    <CardLink external href={instagram.url} className={styles.signalCard} label={label}>
      <span className={`${styles.signalHead} ${styles.wideHead}`} aria-hidden="true">INSTAGRAM</span>
      <span className={styles.signalText} aria-hidden="true">{instagram.handle}</span>
      <span className={styles.bandTags} aria-hidden="true">
        <Chip>FOLLOW</Chip>
      </span>
    </CardLink>
  );
}
