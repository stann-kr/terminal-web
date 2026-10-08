'use client';
import { Bay, Facts, Panel } from '@/features/ui/Ui';
import styles from './about.module.css';
import content from './content.json';
/** The home About plate's one line; the same in every language. */
export const aboutTagline = content.tagline;
export const aboutCopy = {
  ko: [content.tagline, ...content.manifesto.ko.split('\n\n'), `Terminal Architect : ${content.architect}`],
  en: [content.tagline, ...content.manifesto.en.split('\n\n'), `Terminal Architect : ${content.architect}`],
};
/** The Instagram account: the handle as printed and its profile address, for every place that links to it. */
export const instagram = { handle: `@${content.instagram}`, url: `https://www.instagram.com/${content.instagram}/` };
export const channels = [
  ['TERMINAL INSTAGRAM', instagram.url],
  ['STANN LUMO WEB', 'https://lumo.stann.kr'],
  ['STANN LUMO INSTAGRAM', 'https://www.instagram.com/stannlumo/'],
] as const;
export function NodeFacts() {
  return (
    <Panel title="노드 정보" label="Node" surface="calm" className={styles.node}>
      <Facts
        rows={[
          ['도시', 'SEOUL'],
          ['시간대', 'KST / UTC+9'],
          ['장르', 'TECHNO'],
          ['설계', 'STANN LUMO'],
        ]}
      />
      <Bay label="TERMINAL / NODE" />
    </Panel>
  );
}

export function OfficialChannels() {
  return (
    <Panel title="공식 채널" label="Channels" surface="panel">
      <ul className={styles.channels}>
        {channels.map(([label, href], index) => (
          <li key={href}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <span>0{index + 1}</span>
              <strong>{label}</strong>
              <span className={styles.host} aria-hidden="true">{new URL(href).host}</span>
              <span className={styles.srOnly}>새 탭에서 열기</span>
            </a>
          </li>
        ))}
      </ul>
      <Bay label="CHANNELS / SEOUL" />
    </Panel>
  );
}
