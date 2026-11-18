'use client';
/* eslint-disable @next/next/no-img-element -- A thumbnail of the shirt at its own aspect ratio, no invented dimensions. */
import { merch } from '@/features/merch/content';
import { MerchSheet } from '@/features/merch/Merch';
import { BandName, CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** TERMINAL merch: the current piece's name and price on the home; pictures, facts and how to buy when open. */
export function MerchPlate({ mode }: PlateProps) {
  const item = merch[0];
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/merch" name="MERCH" title={item?.name ?? 'TERMINAL MERCH'} meta={item?.edition.split(' ')[0]} />;
  if (mode !== 'hero') {
    // The price, then where it is sold, a line each beside the back of the shirt.
    const [price, where] = item ? [item.price, item.sale.split(' · ').slice(1).join(' · ')] : ['준비 중입니다', ''];
    const thumb = item?.images.find(image => image.label === 'BACK · CENTER') ?? item?.images[0];
    return (
      <CardLink href="/merch" className={`${styles.summaryCard} ${styles.merchCard}`}>
        {thumb && <img className={styles.merchThumb} src={thumb.src} alt="" decoding="async" />}
        <span className={styles.merchText}>
          <span className={styles.band}>
            <span className={styles.bandTitle}>
              <span className={styles.bandLabel} aria-hidden="true">Merch</span>
              <BandName title={item?.name ?? 'TERMINAL MERCH'} link />
            </span>
          </span>
          <span className={styles.merchLine}>
            <span>{price}</span>
            {where && <span>{where}</span>}
          </span>
        </span>
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
    <div className={styles.merchStage}>
      <FocusHead label="Merch" title={item.name} tags={<Tags items={[item.edition, item.price]} />} />
      <MerchSheet item={item} />
    </div>
  );
}
