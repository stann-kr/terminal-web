'use client';
import { instagram } from '@/features/about/instagram';
import { CardLink, ChipFace, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const label = `인스타그램 ${instagram.handle} 팔로우, 새 탭에서 열기`;

/**
 * The account as a plate of its own: a link out at every size, the handle printed large. It has no
 * open state; pressing it opens the profile in a new tab (the app, on a phone that has it).
 */
export function InstagramPlate({ mode }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace external href={instagram.url} name="INSTAGRAM" title="팔로우" meta={instagram.handle} label={label} />;
  return (
    <CardLink external href={instagram.url} className={styles.instagramCard} label={label}>
      <span className={styles.band}>
        <span className={styles.bandTitle}>
          <span className={styles.bandLabel} aria-hidden="true">Instagram</span>
          <span className={styles.bandKo}>팔로우</span>
        </span>
        <span className={styles.bandTags} aria-hidden="true"><Tags items={['FOLLOW']} /></span>
      </span>
      <span className={styles.instagramHandle} aria-hidden="true">{instagram.handle}</span>
      <span className={styles.instagramNote} aria-hidden="true">이벤트 소식 · 현장 기록</span>
    </CardLink>
  );
}
