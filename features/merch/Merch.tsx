'use client';
/* eslint-disable @next/next/no-img-element -- Like the posters: mockups from the media host keep their own aspect ratio, without invented dimensions. */
import { useState } from 'react';
import { useLanguage } from '@/features/shell/Providers';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { Action, ActionDeck, Facts, Panel } from '@/features/ui/Ui';
import { eventHref } from '@/features/events/model';
import type { MerchItem } from './content';
import styles from './merch.module.css';

/**
 * A piece's pictures: the chosen one large, the rest as keys below. Each key is a real button; the
 * large picture opens the original in a new tab.
 */
export function MerchGallery({ item }: { item: MerchItem }) {
  const [shown, setShown] = useState(0);
  const image = item.images[shown] ?? item.images[0];
  return (
    <Panel title={item.name} label="Merch" code={item.edition} surface="inset" className={styles.galleryPanel}>
      <div className={styles.gallery}>
        <a className={styles.lead} href={image.src} target="_blank" rel="noopener noreferrer">
          <img src={image.src} alt={`${image.alt} — 새 탭에서 확대`} decoding="async" />
        </a>
        <div className={styles.thumbs} role="group" aria-label="사진 고르기">
          {item.images.map((entry, index) => (
            <button key={entry.src} type="button" className={styles.thumb} aria-pressed={index === shown} onClick={() => setShown(index)}>
              <img src={entry.src} alt="" decoding="async" />
              <span>{entry.label}</span>
              <span className={styles.srOnly}>{entry.alt} 보기</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** What it is: the facts, then the story behind the print. */
export function MerchFacts({ item }: { item: MerchItem }) {
  const { language } = useLanguage();
  return (
    <Panel title="정보" label="Spec" code={item.price} aside={<LanguageToggle />} surface="panel" className={styles.factsPanel}>
      <Facts rows={item.facts} />
      <div className={styles.story} lang={language}>
        {item.story[language].map(line => <p key={line}>{line}</p>)}
      </div>
    </Panel>
  );
}

/** How to get one: on site first, by DM if not, with the session it is sold at. */
export function MerchBuy({ item }: { item: MerchItem }) {
  return (
    <Panel title="구매" label="How to buy" surface="paper" className={styles.buyPanel}>
      <ol className={styles.buy}>
        {item.buy.map(way => (
          <li key={way.label}>
            <b lang="en">{way.label}</b>
            <strong>{way.title}</strong>
            <p>{way.text}</p>
          </li>
        ))}
      </ol>
      <ActionDeck>
        <Action href={eventHref(item.eventId)}>{item.eventId} 이벤트 정보</Action>
        <Action href={item.dm.href} external>DM으로 구매 · {item.dm.handle}<span className={styles.srOnly}> (새 탭)</span></Action>
      </ActionDeck>
    </Panel>
  );
}
