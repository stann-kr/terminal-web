'use client';
import { aboutCopy, NodeFacts, OfficialChannels } from '@/features/about/About';
import { useLanguage } from '@/features/shell/Providers';
import { Panel } from '@/features/ui/Ui';
import { TextPages } from '../TextPages';
import { FocusHead, RailFace, Tags, TileHead } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** About TERMINAL: one line on the home; the introduction, channels and node when open. */
export function AboutPlate({ mode }: PlateProps) {
  const { language } = useLanguage();
  if (mode === 'rail' || mode === 'strip') return <RailFace href="/about" name="ABOUT" title="소개" meta="SEOUL / KST" />;
  if (mode === 'tile') {
    return (
      <div className={styles.tile}>
        <TileHead href="/about" label="About" title="TERMINAL 소개" chips={<Tags items={['SEOUL', 'KST']} />} />
        <p className={styles.aboutLine} lang={language}>{aboutCopy[language][0]}</p>
      </div>
    );
  }
  return (
    <div className={styles.focus}>
      <FocusHead label="About" title="TERMINAL 소개" chips={<Tags items={['SEOUL', 'TECHNO']} />} />
      <div className={styles.panelRow} data-columns="3">
        <Panel title="TERMINAL 소개" label="About" code="SEOUL" surface="navy" className={styles.fitPanel}>
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
