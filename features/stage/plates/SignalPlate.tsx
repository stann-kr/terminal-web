'use client';
import Link from 'next/link';
import { SignalChannel, SignalForm, SignalInformation } from '@/features/signal/Signal';
import { useSignalSubscription } from '@/features/signal/useSignalSubscription';
import { Chip } from '@/features/ui/Ui';
import { FocusHead, RailFace, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** The subscription plate: a loud red call on the home, the channel and its form when open. */
export function SignalPlate({ mode }: PlateProps) {
  if (mode === 'rail' || mode === 'strip') return <RailFace href="/signal" name="SIGNAL" title="소식 신청" meta="CH 01" />;
  if (mode === 'tile') {
    return (
      <Link href="/signal" className={styles.signalTile} scroll={false}>
        <span className={styles.signalHead} aria-hidden="true">SIGNAL</span>
        <span className={styles.signalText}>다음 행사 소식 받기</span>
        <span className={styles.tileChips} aria-hidden="true">
          <Chip>CH 01</Chip>
          <Chip>MAIL</Chip>
          <Chip>INSTAGRAM</Chip>
        </span>
      </Link>
    );
  }
  return <SignalFocus />;
}

function SignalFocus() {
  const request = useSignalSubscription();
  return (
    <div className={styles.focus}>
      <FocusHead label="Signal" title="소식 신청" chips={<Tags items={['CH 01', 'MAIL', 'INSTAGRAM']} />} />
      <div className={styles.panelRow} data-columns="3">
        <div className={styles.fitColumn} data-fit="">
          <SignalInformation request={request} />
        </div>
        <div className={styles.fitColumn} data-fit="">
          <SignalForm request={request} />
        </div>
        <div className={styles.fitColumn} data-fit="">
          <SignalChannel request={request} />
        </div>
      </div>
    </div>
  );
}
