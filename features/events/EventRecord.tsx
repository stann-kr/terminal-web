'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Artist, TerminalEvent } from '@/lib/events/types';
import { getSlotTimes } from '@/lib/events/lifecycle';
import { Action, ActionDeck, BrandText, Facts, ui } from '@/features/ui/Ui';
import { CALENDAR_FEED_PATH, calendarSubscribeHref } from './calendar';
import {
  buildArtistArchive,
  profileForAppearance,
  artistHref,
} from '@/features/artists/model';
import { accessAvailability, eventHref, publicArtists, venueMapHref } from './model';
import styles from './events.module.css';

export function EventFacts({
  event,
  modular = false,
}: {
  event: TerminalEvent;
  modular?: boolean;
}) {
  const groups = [
    {
      label: 'DATE / TIME',
      rows: [
        ['날짜', event.date],
        ['시작 / KST', event.time.replace(' KST', '')],
      ],
    },
    {
      label: 'VENUE',
      rows: [
        ['장소', event.venue],
        ['지역', event.district],
        ['좌표', event.coords],
      ],
    },
  ];
  if (modular)
    return (
      <>
        <div className={styles.factModules}>
          {groups.map((group) => (
            <div key={group.label}>
              <p className={ui.band} lang="en">
                {group.label}
              </p>
              <Facts rows={group.rows.map(([label, value]) => [label, value])} />
            </div>
          ))}
        </div>
        <SessionKeys event={event} />
      </>
    );
  return (
    <Facts
      rows={[
        ['일시 / KST', `${event.date} · ${event.time.replace(' KST', '')}`],
        ['장소', event.venue],
        ['지역', event.district],
        ['좌표', event.coords],
      ]}
    />
  );
}
const noSubscribe = () => () => {};
/** The subscribe link for this browser: `webcal:` on Apple devices, Google Calendar elsewhere. */
function useSubscribeHref() {
  return useSyncExternalStore(
    noSubscribe,
    () => calendarSubscribeHref(location.origin, /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)),
    // The server cannot know the device; the feed itself stands in until hydration.
    () => CALENDAR_FEED_PATH,
  );
}

function KeyFace({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className={styles.keyText}>
      <small lang="en">{label}</small>
      <span>{children}</span>
    </span>
  );
}

/**
 * What a guest does with the date and the place: labelled keys under the facts they act on,
 * filled like every key so they never read as one more fact line. The calendar key subscribes to
 * the whole TERMINAL feed (later changes reach the subscriber); a past session has no map key.
 */
function SessionKeys({ event }: { event: TerminalEvent }) {
  const subscribe = useSubscribeHref();
  const map = event.status === 'ARCHIVED' ? null : venueMapHref(event);
  const [shared, share] = useShare(event);
  return (
    <>
      <ActionDeck className={styles.sessionKeys}>
        <Action primary href={subscribe} external={subscribe.startsWith('https:')}>
          <KeyFace label="CALENDAR">
            <BrandText text="TERMINAL" /> 일정 구독
          </KeyFace>
        </Action>
        {map && (
          <Action primary external href={map}>
            <KeyFace label="MAP">
              지도에서 보기<span className={ui.srOnly}> (구글 지도, 새 탭)</span>
            </KeyFace>
          </Action>
        )}
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => void share()}>
          <KeyFace label="SHARE">{SHARE_TEXT[shared]}</KeyFace>
        </button>
      </ActionDeck>
      <span className={ui.srOnly} role="status">{shared === 'idle' ? '' : SHARE_TEXT[shared]}</span>
    </>
  );
}

type ShareState = 'idle' | 'copied' | 'failed';
/** Short, so the key keeps its size when its text changes. */
const SHARE_TEXT: Record<ShareState, string> = { idle: '링크 공유', copied: '링크 복사됨', failed: '복사 실패' };

/**
 * The session's address, handed on: a phone opens its share sheet (a messenger, a DM), elsewhere the
 * link is copied. What happened shows in the key itself for a moment; nothing else moves.
 */
function useShare(event: TerminalEvent) {
  const [state, setState] = useState<ShareState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);
  async function share() {
    const url = new URL(eventHref(event.id), location.origin).href;
    if (window.matchMedia?.('(pointer: coarse)').matches && navigator.share) {
      try {
        await navigator.share({ title: event.session, url });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  return [state, share] as const;
}

export function EventActions({
  event,
  events,
  now,
}: {
  event: TerminalEvent;
  events: TerminalEvent[];
  now: Date;
}) {
  const access = accessAvailability(event, events, now);
  return (
    <>
    <div className={styles.accessProtocol} data-open={access.canRequest}>
      <p
        data-open={access.canRequest}
        className={`${ui.band} ${styles.protocolLabel}`}
        lang="en"
      >
        {access.canRequest
          ? 'ACCESS OPEN'
          : event.status === 'ARCHIVED'
            ? 'ARCHIVE RECORD'
            : 'ACCESS INFO'}
      </p>
      <p className={ui.muted}>{access.message}</p>
    </div>
    <ActionDeck className={styles.accessDeck}>
      {access.canRequest && (
        <Action primary href={`${eventHref(event.id)}/request`} carrier={`event:${event.id}`}>
          게스트 신청
        </Action>
      )}
      <Action href="/signal">다음 이벤트 소식 신청</Action>
    </ActionDeck>
    </>
  );
}
export function Lineup({
  event,
  events,
  stages = false,
  now,
}: {
  event: TerminalEvent;
  events: TerminalEvent[];
  stages?: boolean;
  now?: Date;
}) {
  const profiles = buildArtistArchive(events);
  const visible = publicArtists(event);
  // While the session runs, the slot the published timetable is on. It is the timetable, not what
  // is playing: the dock band says so, and a slot without times (TBA) is never marked.
  const onNow = (artist: Artist) => {
    if (event.status !== 'LIVE' || !now) return false;
    const slot = getSlotTimes(event, artist.time);
    return !!slot && slot.start <= now && now < slot.end;
  };
  function identity(artist: Artist) {
    const profile = profileForAppearance(profiles, event.id, artist.id);
    return (
      <>
        {profile ? (
          <Link href={artistHref(profile.key)} data-carrier={`artist:${profile.key}`} scroll={false}>{artist.name}</Link>
        ) : (
          artist.name
        )}
        <small>{artist.origin}</small>
      </>
    );
  }
  const identityLinked = (artist: Artist) => !!profileForAppearance(profiles, event.id, artist.id);
  if (!visible.length) return null;
  return (
    <>
      {stages ? (
        <div>
          {[...new Set(visible.map((artist) => artist.dock || 'TBA'))].map(
            (dock) => (
              <section
                key={dock}
                aria-label={`무대 ${dock}`}
              >
                <h3 className={ui.band}>
                  <span>DOCK {dock}</span>
                  <span>
                    {visible.some((artist) => (artist.dock || 'TBA') === dock && onNow(artist))
                      ? '시간표 기준 지금 순서'
                      : '공개 공연표'}
                  </span>
                </h3>
                <ul className={styles.stageSlots}>
                  {visible
                    .filter((artist) => (artist.dock || 'TBA') === dock)
                    .map((artist) => (
                      <li key={artist.id} data-origin="" data-now={onNow(artist) || undefined}>
                        <div className={styles.slotCode}>
                          {artist.id}
                          <span>
                            {onNow(artist) ? (
                              <>
                                NOW
                                <span className={ui.srOnly}> (시간표 기준 지금 순서)</span>
                              </>
                            ) : artist.status === 'ARCHIVED'
                              ? 'ARCHIVE'
                              : 'CONFIRMED'}
                          </span>
                        </div>
                        <div className={styles.slotArtist} data-linked={identityLinked(artist) || undefined}>
                          {identity(artist)}
                        </div>
                        <p className={styles.slotTime}>
                          <span>TIME</span>
                          {artist.time}
                        </p>
                      </li>
                    ))}
                </ul>
              </section>
            ),
          )}
        </div>
      ) : (
        <ul className={styles.lineup}>
          {visible.map((artist) => (
            <li key={artist.id} data-origin="">
              <span className={styles.dock}>{artist.dock}</span>
              <div>{identity(artist)}</div>
              <time>{artist.time}</time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
