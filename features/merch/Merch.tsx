'use client';
/* eslint-disable @next/next/no-img-element -- Like the posters: mockups from the media host keep their own aspect ratio, without invented dimensions. */
import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/features/shell/Providers';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { Arrow, Facts, ui } from '@/features/ui/Ui';
import Link from '@/features/ui/RouteLink';
import { eventHref } from '@/features/events/model';
import type { MerchItem } from './content';
import styles from './merch.module.css';

/** A column's head, as on every panel: the English label large, the Korean title beside it. */
function Head({ label, title, aside }: { label: string; title: string; aside?: ReactNode }) {
  return (
    <header className={`${ui.panelHead} ${styles.head}`}>
      <h2 className={ui.panelTitle} data-labelled>
        <span className={ui.panelLabel} aria-hidden="true">{label}</span>
        <span className={ui.panelKo}>{title}</span>
      </h2>
      {aside}
    </header>
  );
}

/**
 * The open merch sheet: the pictures (the chosen one large, the rest as keys below), the spec, and how
 * to buy with the DM and the session's file along the foot. Three columns side by side; on a phone the
 * columns dissolve into one run in the order a buyer reads: picture, size, spec, price and the DM key,
 * then the story, the DM way and the session.
 */
export function MerchSheet({ item }: { item: MerchItem }) {
  const { language } = useLanguage();
  const [shown, setShown] = useState(0);
  const image = item.images[shown] ?? item.images[0];
  return (
    <div className={styles.sheet}>
      <div className={styles.photos} data-surface="inset">
        <h2 className={styles.srOnly}>사진</h2>
        <a className={styles.lead} href={image.src} target="_blank" rel="noopener noreferrer">
          <img src={image.src} alt={`${image.alt} — 새 탭에서 확대`} decoding="async" />
        </a>
        <div className={styles.thumbs} role="group" aria-label="사진 고르기">
          {item.images.map((entry, index) => (
            <button key={entry.src} type="button" className={styles.thumb} aria-pressed={index === shown} onClick={() => setShown(index)}>
              <img src={entry.src} alt="" decoding="async" />
              <span className={styles.thumbLabel}>{entry.label}</span>
              <span className={styles.thumbShort} aria-hidden="true">{entry.short}</span>
              <span className={styles.srOnly}>{entry.alt} 보기</span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.spec} data-surface="panel">
        <Head label="Spec" title="정보" aside={<LanguageToggle />} />
        <dl className={styles.sizes} aria-label="사이즈">
          {item.sizes.map(([size, measure]) => (
            <div key={size}>
              <dt>{size}</dt>
              <dd>{measure}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.facts}>
          <Facts rows={item.facts} />
        </div>
        <div className={styles.story} lang={language}>
          {item.story[language].map(line => <p key={line}>{line}</p>)}
        </div>
      </div>
      <div className={styles.buyColumn} data-surface="paper">
        <Head label="How to buy" title="구매" />
        <ol className={styles.buy}>
          {item.buy.map((way, index) => (
            <li key={way.label} data-surface={index === 0 ? 'mark' : undefined}>
              <b lang="en">{index + 1} · {way.label}</b>
              <strong>{way.title}</strong>
              {index === 0 && <span className={styles.price}>{item.price}</span>}
              <p>{way.text}</p>
            </li>
          ))}
        </ol>
        <a className={styles.dmKey} href={item.dm.href} target="_blank" rel="noopener noreferrer" data-surface="feature">
          <span>DM으로 사이즈 보내기</span>
          <span className={styles.srOnly}> {item.dm.handle} (새 탭)</span>
          <Arrow external />
        </a>
        <Link className={styles.eventKey} href={eventHref(item.eventId)} data-surface="panel">
          <span>{item.eventId} 이벤트 정보</span>
          <Arrow />
        </Link>
      </div>
    </div>
  );
}
