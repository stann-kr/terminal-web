'use client';
import { useLanguage } from '@/features/shell/Providers';
import { FullText, PageHeading, Panel } from '@/features/ui/Ui';
import styles from './about.module.css';
const copy = {
  ko: ['TERMINAL은 서울 기반의 테크노 플랫폼입니다.', '음악과 사람들이 만나는 공간을 만들고, 이벤트와 참여 아티스트의 기록을 이어갑니다.'],
  en: ['TERMINAL is a Seoul-based techno platform.', 'We create spaces for music and people, and keep a record of our events and artists.'],
};
const channels = [['TERMINAL INSTAGRAM','https://www.instagram.com/terminal_hub/'],['STANN LUMO WEB','https://lumo.stann.kr'],['STANN LUMO INSTAGRAM','https://www.instagram.com/stannlumo/'],['STANN OS HUB','https://stann.kr']] as const;
export function About() {
  const { language }=useLanguage();
  return <><PageHeading title="음악이 시작되고, 사람이 모이는 곳"/><div className={styles.layout}><Panel title="TERMINAL" code="SEOUL"><p className={styles.statement}>MUSIC.<br/>PEOPLE.<br/>CONTINUITY.</p><FullText language={language} excerpt={false} paragraphs={copy[language]}/><p className={styles.credit}>Terminal Architect: STANN LUMO</p></Panel><Panel title="공식 채널" code="LINKS"><ul className={styles.channels}>{channels.map(([label,href],index) => <li key={href}><a href={href} target="_blank" rel="noopener noreferrer"><span>0{index+1}</span><strong>{label}</strong><span className={styles.srOnly}>새 탭에서 열기</span></a></li>)}</ul><div className={styles.aboutBlocks} aria-hidden="true"><i/><i/><i/></div></Panel></div></>;
}
