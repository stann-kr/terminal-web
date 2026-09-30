'use client';
import { aboutCopy, aboutTagline, NodeFacts, OfficialChannels } from '@/features/about/About';
import { useLanguage } from '@/features/shell/Providers';
import { BrandText, Panel } from '@/features/ui/Ui';
import { TextPages } from '../TextPages';
import { CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** About TERMINAL: one line on the home; the introduction, channels and node when open. */
export function AboutPlate({ mode }: PlateProps) {
  const { language } = useLanguage();
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/about" name="ABOUT" title="소개" meta="SEOUL / KST" />;
  if (mode !== 'hero') {
    return (
      <CardLink href="/about" className={styles.summaryCard}>
        <span className={styles.band}>
          <span className={styles.bandTitle}>
            <span className={styles.bandLabel} aria-hidden="true">About</span>
            <span className={styles.bandKo}><BrandText text="TERMINAL 소개" /></span>
          </span>
          <span className={styles.bandTags} aria-hidden="true"><Tags items={['SEOUL', 'KST']} /></span>
        </span>
        <span className={styles.aboutLine} lang="en">{aboutTagline}</span>
      </CardLink>
    );
  }
  return (
    <div className={styles.face}>
      <FocusHead label="About" title="TERMINAL 소개" tags={<Tags items={['SEOUL', 'TECHNO']} />} />
      <div className={styles.panelRow} data-columns="3">
        <Panel title="TERMINAL 소개" label="About" code="SEOUL" surface="inset" className={styles.fitPanel}>
          <p className={styles.statement} aria-hidden="true">TERMINAL</p>
          <TextPages paragraphs={aboutCopy[language]} language={language} label="TERMINAL 소개" />
        </Panel>
        <div className={styles.fitColumn} data-fit="">
          <OfficialChannels />
        </div>
        <div className={styles.fitColumn} data-fit="">
          <NodeFacts />
        </div>
      </div>
    </div>
  );
}
