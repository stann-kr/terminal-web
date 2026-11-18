'use client';
import { merch } from '@/features/merch/content';
import { MerchBuy, MerchFacts, MerchGallery } from '@/features/merch/Merch';
import { FitTitle } from '../FitTitle';
import { BandName, CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** TERMINAL merch: the current piece's name and price on the home; pictures, facts and how to buy when open. */
export function MerchPlate({ mode }: PlateProps) {
  const item = merch[0];
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/merch" name="MERCH" title={item?.name ?? 'TERMINAL MERCH'} meta={item?.edition.split(' ')[0]} />;
  if (mode !== 'hero') {
    const line = item ? item.sale : '준비 중입니다';
    return (
      <CardLink href="/merch" className={`${styles.summaryCard} ${styles.aboutCard} ${styles.merchCard}`}>
        <span className={styles.band}>
          <span className={styles.bandTitle}>
            <span className={styles.bandLabel} aria-hidden="true">Merch</span>
            <BandName title={item?.name ?? 'TERMINAL MERCH'} link />
          </span>
          {item && <span className={styles.bandTags} aria-hidden="true"><Tags items={[item.edition]} /></span>}
        </span>
        <FitTitle as="span" text={line} maxLines={1} minPx={14} className={styles.aboutLine}>
          {line}
        </FitTitle>
      </CardLink>
    );
  }
  if (!item) {
    return (
      <div className={styles.face}>
        <FocusHead label="Merch" title="TERMINAL MERCH" />
        <p>다음 상품은 준비되는 대로 이곳에 표시됩니다.</p>
      </div>
    );
  }
  return (
    <div className={styles.face}>
      <FocusHead label="Merch" title={item.name} tags={<Tags items={[item.edition, item.price]} />} />
      <div className={styles.panelRow} data-columns="3" data-paged="first">
        <MerchGallery item={item} />
        <div className={styles.fitColumn} data-fit="">
          <MerchFacts item={item} />
        </div>
        <div className={styles.fitColumn} data-fit="">
          <MerchBuy item={item} />
        </div>
      </div>
    </div>
  );
}
