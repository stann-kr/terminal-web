'use client';
import { Bay, Facts, Panel } from '@/features/ui/Ui';
import styles from './about.module.css';
export const aboutCopy = {
  ko: [
    'TERMINAL은 서울 기반의 테크노 플랫폼입니다.',
    '행사를 기획해 열고, 행사와 참여 아티스트의 기록을 공개합니다.',
  ],
  en: [
    'TERMINAL is a Seoul-based techno platform.',
    'We produce events and publish the records of each event and its artists.',
  ],
};
export const channels = [
  ['TERMINAL INSTAGRAM', 'https://www.instagram.com/terminal_hub/'],
  ['STANN LUMO WEB', 'https://lumo.stann.kr'],
  ['STANN LUMO INSTAGRAM', 'https://www.instagram.com/stannlumo/'],
  ['STANN OS HUB', 'https://stann.kr'],
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
