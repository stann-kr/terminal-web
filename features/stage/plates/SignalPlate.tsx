'use client';
import { SignalBody } from '@/features/signal/Signal';
import Link from '@/features/ui/RouteLink';
import { dayMark, eventHref, eventSubtitle, sessionShort } from '@/features/events/model';
import { channels, handle } from '@/features/about/About';
import type { TerminalEvent } from '@/lib/events/types';
import { Arrow, BrandText, Chip } from '@/features/ui/Ui';
import { FitTitle } from '../FitTitle';
import { Rings } from '../Rings';
import { CardLink, ChipFace, FocusHead } from './faces';
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
  return <SignalFocus next={data.next} now={data.now} rings={rings} />;
}

/**
 * The open channel: on the left the note under the plate's name, the form below it and its save
 * key along the foot; on the right the session it would have told of first, and the way to the
 * channels.
 */
function SignalFocus({ next, now, rings }: { next: TerminalEvent | null; now: Date; rings?: PlateProps['rings'] }) {
  // The session the subscription would have told of first, while it is still to come.
  const coming = next && next.status !== 'ARCHIVED' ? next : null;
  return (
    <div className={styles.signalStage}>
      <SignalBody
        head={<FocusHead label="Signal" title="소식 신청" />}
        wrap={(part, key) => (
          <div className={key === 'intro' ? styles.signalIntro : styles.signalForm} data-surface={key === 'intro' ? 'mark' : 'paper'} data-fit="">
            {part}
          </div>
        )}
      />
      {coming && (
        <Link href={eventHref(coming.id)} className={`${styles.card} ${styles.signalNext}`} data-surface="feature" data-carrier={`event:${coming.id}`} scroll={false}>
          {rings && <Rings at={rings} under />}
          <span className={styles.signalNextHead} lang="en">Next session · {dayMark(coming, now)}</span>
          <span className={styles.signalNextBody}>
            <FitTitle as="span" text={sessionShort(coming.session)} maxLines={1} minPx={24} className={styles.signalNextName}>
              <BrandText text={sessionShort(coming.session)} />
            </FitTitle>
            {eventSubtitle(coming) && <span className={styles.signalNextSub}>{eventSubtitle(coming)}</span>}
          </span>
          <span className={styles.signalNextMeta}>{coming.date} · {coming.time.replace(' KST', '')} KST · {coming.venue}</span>
        </Link>
      )}
      <Link href="/about" className={`${styles.card} ${styles.signalChannel}`} data-surface="calm" scroll={false}>
        <span>
          <b>소개 · 공식 채널</b>
          <small>{channels.slice(0, 2).map(([, href]) => handle(href)).join(' · ')}</small>
        </span>
        <Arrow />
      </Link>
    </div>
  );
}
