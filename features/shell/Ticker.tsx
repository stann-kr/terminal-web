'use client';
import { getFutureUpcomingEvent, getLiveEvents } from '@/lib/events/lifecycle';
import { useEvents } from '@/features/events/data';
import { publicArtists } from '@/features/events/model';
import { BrandText } from '@/features/ui/Ui';
import styles from './shell.module.css';

/**
 * A running strip of real schedule data along the foot bar, like a flyer ticker. Decorative:
 * the same facts are on the pages, so it stays out of the accessibility tree.
 */
export function Ticker() {
  const { events, now } = useEvents();
  if (!events?.length) return <p className={styles.zone}>ALL EVENT TIMES / KST</p>;
  const live = getLiveEvents(events, now);
  const next = getFutureUpcomingEvent(events, now);
  const items: string[] = [];
  for (const event of live) items.push(`LIVE NOW — ${event.session} — ${event.venue}`);
  if (next) {
    items.push(`NEXT SESSION — ${next.session} — ${next.date} ${next.time.replace(' KST', '')} KST — ${next.venue}`);
    const lineup = publicArtists(next).map((artist) => artist.name);
    items.push(lineup.length ? `LINEUP — ${lineup.join(' / ')}` : 'LINEUP — TBA');
  }
  items.push(`${String(events.length).padStart(3, '0')} SESSIONS ON RECORD`);
  items.push('ALL EVENT TIMES / KST');
  const run = items.map((item, index) => <span key={index}><BrandText text={item} /></span>);
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.tickerTrack}>
        <p>{run}</p>
        <p>{run}</p>
      </div>
    </div>
  );
}
