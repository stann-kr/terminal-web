'use client';
import { instagram } from '@/features/about/instagram';
import { CardLink, ChipFace, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const label = `인스타그램 ${instagram.handle} 팔로우, 새 탭에서 열기`;

/** The Instagram account: a summary plate like the others, its band the whole of it; it opens the profile in a new tab. */
export function InstagramPlate({ mode }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace external href={instagram.url} name="INSTAGRAM" title="팔로우" meta={instagram.handle} label={label} />;
  return (
    <CardLink external href={instagram.url} className={styles.summaryCard} label={label}>
      <span className={styles.band}>
        <span className={styles.bandTitle}>
          <span className={styles.bandLabel} aria-hidden="true">Instagram</span>
          <span className={styles.bandKo} aria-hidden="true">{instagram.handle}</span>
        </span>
        <span className={styles.bandTags} aria-hidden="true"><Tags items={['FOLLOW']} /></span>
      </span>
    </CardLink>
  );
}
