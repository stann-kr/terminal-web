'use client';
import { aboutCopy, NodeFacts, OfficialChannels } from '@/features/about/About';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { Panel } from '@/features/ui/Ui';
import { BandName, CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** About TERMINAL: one line on the home; the introduction, channels and node when open. */
export function AboutPlate({ mode }: PlateProps) {
  const { language } = useLanguage();
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/about" name="ABOUT" title="소개" />;
  if (mode !== 'hero') {
    return (
      <CardLink href="/about" className={`${styles.summaryCard} ${styles.aboutCard}`}>
        <span className={styles.band}>
          <span className={styles.bandTitle}>
            <span className={styles.bandLabel} aria-hidden="true">About</span>
            <BandName title="TERMINAL 소개" link />
          </span>
        </span>
      </CardLink>
    );
  }
  // The tagline leads, the manifesto runs in two columns with no pages, the architect signs it.
  const copy = aboutCopy[language];
  const [lead, body, sign] = [copy[0], copy.slice(1, -1), copy.at(-1)];
  return (
    <div className={styles.face}>
      <FocusHead label="About" title="TERMINAL 소개" tags={<Tags items={['SEOUL', 'TECHNO']} />} />
      <div className={`${styles.panelRow} ${styles.aboutRow}`} data-columns="2">
        <div className={styles.fitColumn} data-fit="">
          <Panel title="소개 글" label="Manifesto" code="SEOUL" aside={<LanguageToggle />} surface="inset">
            <p className={styles.statement} aria-hidden="true">TERMINAL</p>
            <div className={styles.manifesto} lang={language} role="group" aria-label="TERMINAL 소개">
              <p className={styles.manifestoLead}>{lead}</p>
              <div className={styles.manifestoBody}>
                {body.map(text => <p key={text}>{text}</p>)}
              </div>
              <p className={styles.manifestoSign}>{sign}</p>
            </div>
          </Panel>
        </div>
        <div className={styles.fitColumn} data-fit="">
          <OfficialChannels />
          <NodeFacts />
        </div>
      </div>
    </div>
  );
}
