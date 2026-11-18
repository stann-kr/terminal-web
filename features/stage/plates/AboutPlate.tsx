'use client';
import { aboutCopy, NodeFacts, OfficialChannels } from '@/features/about/About';
import { LanguageToggle } from '@/features/shell/LanguageToggle';
import { useLanguage } from '@/features/shell/Providers';
import { CardLink, ChipFace, FocusHead } from './faces';
import { FitTitle } from '../FitTitle';
import { BrandText } from '@/features/ui/Ui';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** About TERMINAL: one line on the home; the introduction, channels and node when open. */
export function AboutPlate({ mode }: PlateProps) {
  const { language } = useLanguage();
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/about" name="ABOUT" title="소개" />;
  if (mode !== 'hero') {
    return (
      // Two lines like the SIGNAL tile: the name large at the head, the way in at the foot.
      <CardLink href="/about" className={styles.signalCard}>
        <span className={styles.signalHead} aria-hidden="true">ABOUT</span>
        <FitTitle as="span" text="TERMINAL 소개" maxLines={1} minPx={14} className={styles.signalText} arrow="in">
          <BrandText text="TERMINAL" /> 소개
        </FitTitle>
      </CardLink>
    );
  }
  // The tagline and the opening line stand under the name; the manifesto's labelled sections run in
  // two columns (the definition, then the principle and the objective); the architect signs it.
  const copy = aboutCopy[language];
  const [tagline, opening, ...paragraphs] = copy.slice(0, -1);
  const sign = copy.at(-1);
  const sections: { label: string; paragraphs: string[] }[] = [];
  for (const text of paragraphs) {
    const label = text.match(/^\[\s*(.+?)\s*\]\n?/);
    if (label || !sections.length) sections.push({ label: label?.[1] ?? '', paragraphs: [] });
    sections[sections.length - 1].paragraphs.push(label ? text.slice(label[0].length) : text);
  }
  const section = ({ label, paragraphs }: (typeof sections)[number]) => (
    <section key={label} className={styles.aboutSection}>
      {label && <h2 className={styles.aboutLabel}>{label}</h2>}
      {paragraphs.map(text => <p key={text}>{text}</p>)}
    </section>
  );
  return (
    <div className={styles.aboutStage}>
      <div className={styles.aboutMain} lang={language} role="group" aria-label="TERMINAL 소개">
        <div className={styles.aboutIntro} data-surface="panel" data-fit="">
          <FocusHead label="About" title="소개" />
          <span className={styles.statement} aria-hidden="true">TERMINAL</span>
          <div className={styles.aboutLine}>
            <p>{tagline}</p>
            <p>{opening}</p>
            <span className={styles.aboutToggle}><LanguageToggle /></span>
          </div>
        </div>
        <div className={styles.aboutBody} data-surface="inset" data-fit="">
          <div className={styles.aboutColumns}>
            <div>{sections.slice(0, 1).map(section)}</div>
            <div>{sections.slice(1).map(section)}</div>
          </div>
        </div>
        <div className={styles.aboutSign} data-surface="inset">
          <p>{sign}</p>
          {/* The privacy policy, kept out of the home: its way in is at the foot of the about page. */}
          <a href="/privacy" lang="ko" className={styles.aboutPrivacy}>개인정보처리방침</a>
        </div>
      </div>
      <div className={styles.aboutSide} data-surface="calm" data-fit="">
        <OfficialChannels />
        <NodeFacts />
      </div>
    </div>
  );
}
