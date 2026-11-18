'use client';
import { SignalBody } from '@/features/signal/Signal';
import Link from '@/features/ui/RouteLink';
import { dayMark, eventHref } from '@/features/events/model';
import type { TerminalEvent } from '@/lib/events/types';
import { Arrow, BrandText, Chip, ui } from '@/features/ui/Ui';
import { FitTitle } from '../FitTitle';
import { Rings } from '../Rings';
import { CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

/** The subscription plate: a call on the home, the channel and its form when open. */
export function SignalPlate({ mode, rings, data }: PlateProps) {
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/signal" name="SIGNAL" title="소식 신청" meta="CH 01" />;
  if (mode !== 'hero') {
    return (
      <CardLink href="/signal" className={styles.signalCard}>
        {rings && <Rings at={rings} under />}
        <span className={styles.signalHead} aria-hidden="true">SIGNAL</span>
        {/* One line, set down to fit a narrow card: a second line would not fit a low home card. */}
        <FitTitle as="span" text="다음 이벤트 소식 받기" maxLines={1} minPx={14} className={styles.signalText} arrow="in" />
        <span className={styles.bandTags} aria-hidden="true">
          <Chip>CH 01</Chip>
          <Chip>MAIL</Chip>
          <Chip>INSTAGRAM</Chip>
        </span>
      </CardLink>
    );
  }
  return <SignalFocus next={data.next} now={data.now} />;
}

function SignalFocus({ next, now }: { next: TerminalEvent | null; now: Date }) {
  // The session the subscription would have told of first, while it is still to come.
  const coming = next && next.status !== 'ARCHIVED' ? next : null;
  const aside = coming && (
    <Link href={eventHref(coming.id)} className={styles.signalNext} data-carrier={`event:${coming.id}`} scroll={false}>
      <span className={ui.band} lang="en"><span>Next session</span><span>{dayMark(coming, now)}</span></span>
      <span className={styles.signalNextName}><BrandText text={coming.session} /><Arrow /></span>
      <span className={styles.signalNextMeta}>{coming.date} · {coming.time || 'TBA'} · {coming.venue}</span>
    </Link>
  );
  return (
    <div className={styles.face}>
      <FocusHead label="Signal" title="소식 신청" tags={<Tags items={['CH 01', 'MAIL', 'INSTAGRAM']} />} />
      <div className={styles.panelRow} data-columns="2">
        <SignalBody aside={aside} wrap={part => <div className={styles.fitColumn} data-fit="">{part}</div>} />
      </div>
    </div>
  );
}
