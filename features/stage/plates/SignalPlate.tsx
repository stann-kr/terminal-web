'use client';
import { SignalBody } from '@/features/signal/Signal';
import { Chip } from '@/features/ui/Ui';
import { Rings } from '../Rings';
import { CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** The subscription plate: a loud red call on the home, the channel and its form when open. */
export function SignalPlate({ mode, rings }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/signal" name="SIGNAL" title="소식 신청" meta="CH 01" />;
  if (mode !== 'hero') {
    return (
      <CardLink href="/signal" className={styles.signalCard}>
        {rings && <Rings at={rings} under />}
        <span className={styles.signalHead} aria-hidden="true">SIGNAL</span>
        <span className={styles.signalText}>다음 행사 소식 받기</span>
        <span className={styles.bandTags} aria-hidden="true">
          <Chip>CH 01</Chip>
          <Chip>MAIL</Chip>
          <Chip>INSTAGRAM</Chip>
        </span>
      </CardLink>
    );
  }
  return <SignalFocus />;
}

function SignalFocus() {
  return (
    <div className={styles.face}>
      <FocusHead label="Signal" title="소식 신청" tags={<Tags items={['CH 01', 'MAIL', 'INSTAGRAM']} />} />
      <div className={styles.panelRow} data-columns="3">
        <SignalBody wrap={part => <div className={styles.fitColumn} data-fit="">{part}</div>} />
      </div>
    </div>
  );
}
