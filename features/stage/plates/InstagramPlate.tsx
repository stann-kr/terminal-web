'use client';
import { instagram } from '@/features/about/instagram';
import { CardLink, ChipFace } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const label = `인스타그램 ${instagram.handle} 팔로우, 새 탭에서 열기`;

/**
 * The account as a plate of its own, a link out at every size. Larger than a chip it reads like the
 * subscription card: the big name and its line, with the handle in a tone cell filling the card's
 * right end. It has no open state; pressing it opens the profile in a new tab (the app, on a phone).
 */
export function InstagramPlate({ mode }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace external href={instagram.url} name="INSTAGRAM" title="팔로우" meta={instagram.handle} label={label} />;
  return (
    <CardLink external href={instagram.url} className={styles.instagramCard} label={label}>
      <span className={styles.instagramName} aria-hidden="true">
        <span className={styles.instagramHead}>INSTAGRAM</span>
        <span className={styles.instagramText}>팔로우</span>
      </span>
      <span className={styles.instagramAccount} aria-hidden="true">
        <small>ACCOUNT</small>
        {instagram.handle}
      </span>
    </CardLink>
  );
}
