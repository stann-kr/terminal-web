'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { HostView } from '@/lib/gate/hostView';
import { inviteHref } from '@/features/access/invite';
import { SITE_ORIGIN, sessionNamesBrand } from '@/features/events/metadata';
import { sessionShort } from '@/features/events/model';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import { useShareLink, type ShareState } from '@/features/ui/share';
import { Action, BrandText, Facts, Loading, PageHeading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { Consent, Field, FormError, formStyles, literalInput } from '@/features/ui/Form';
import styles from './host.module.css';

/** Places drawn as cells; a longer list shows its numbers alone. */
const MAX_CELLS = 30;
/** The largest guest limit a code may carry (lib/gate/createAccessRequest): no limit in practice. */
const UNLIMITED = 10_000;
const COPY_TEXT: Record<ShareState, string> = { idle: '링크 복사', copied: '링크 복사됨', failed: '복사 실패' };
const SHARE_TEXT: Record<ShareState, string> = { idle: '공유하기', copied: '링크 복사됨', failed: '복사 실패' };

/** `10.29 14:02`, as the clock in Seoul read it. */
const kstStamp = (iso: string) => {
  const kst = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${kst.slice(5, 7)}.${kst.slice(8, 10)} ${kst.slice(11, 16)}`;
};
const two = (value: number) => String(value).padStart(2, '0');
const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)}MB`;

/**
 * What an artist opens from the link TERMINAL sends them: the invite link to hand their guests,
 * and the names of those who used it. The `t` in the address is the credential; the server checks
 * it and answers the same for any link that does not hold.
 */
export function HostPage({ artistId }: { artistId: string }) {
  const token = useSearchParams()?.get('t') ?? '';
  const query = useQuery({
    queryKey: ['host', artistId, token],
    queryFn: () => postJson<HostView>('/api/invite/host', { artistId, t: token }),
    enabled: Boolean(artistId && token),
    retry: false,
  });
  if (!artistId || !token || (query.error instanceof ApiError && query.error.code === 'INVALID_HOST_LINK')) {
    return (
      <>
        <PageHeading title="게스트 초대 페이지" />
        <StateNotice error title="링크를 확인할 수 없습니다">
          <p>받은 링크 전체가 주소창에 들어갔는지 확인해 주십시오. 링크가 바뀌었다면 TERMINAL에 다시 요청해 주십시오.</p>
        </StateNotice>
      </>
    );
  }
  // Only a first load that failed has nothing to show. A later check that fails (the page asks
  // again whenever it is looked at) leaves the last list, and whatever the artist was typing, up.
  if (!query.data) {
    if (!query.error) return <><PageHeading title="게스트 초대 페이지" /><Loading /></>;
    return (
      <>
        <PageHeading title="게스트 초대 페이지" />
        <StateNotice error title="초대 현황을 불러오지 못했습니다" retry={() => void query.refetch()}>
          <p>{errorMessage(query.error)}</p>
        </StateNotice>
      </>
    );
  }
  return (
    <HostPlates
      view={query.data}
      artistId={artistId}
      token={token}
      stale={query.error ? () => void query.refetch() : undefined}
    />
  );
}

function HostPlates({ view, artistId, token, stale }: {
  view: HostView;
  artistId: string;
  token: string;
  /** Set while the last check failed: what is shown is the list as it was last read, and this asks again. */
  stale?: () => void;
}) {
  const link = new URL(inviteHref(view.event.id, view.code), SITE_ORIGIN).href;
  const { state, share, copy } = useShareLink();
  // Which of the two link keys was pressed last, so only that one shows the result.
  const [lastKey, setLastKey] = useState<'copy' | 'share' | null>(null);
  const full = view.count >= view.limit;
  // The code's ceiling (TERMINAL's own list) reads as no limit; any other limit is printed.
  const unlimited = view.limit >= UNLIMITED;
  const cells = view.limit <= MAX_CELLS;
  // A full list still takes guests, onto its waitlist: the link is not closed.
  const band = !view.open && !full ? 'CLOSED' : full ? 'FULL · WAITLIST' : unlimited ? 'OPEN' : `OPEN · ${view.limit - view.count} LEFT`;
  return (
    <div className={styles.page}>
      <PageHeading title={`${view.artist} 게스트 초대`} />
      <header className={styles.head} data-surface="inset">
        <span className={styles.headLabel} aria-hidden="true">HOST</span>
        <span className={styles.headKo}>게스트 초대</span>
        <span className={styles.headEvent}>
          <BrandText text={view.event.session} /> · {view.event.id}
        </span>
      </header>
      {stale && (
        <StateNotice title="최신 현황을 불러오지 못했습니다" retry={stale}>
          <p>아래는 마지막으로 확인한 현황입니다.</p>
        </StateNotice>
      )}
      <div className={styles.plates}>
        <Panel title="초대인" label="Artist" surface="feature" heading={false}>
          <p className={styles.artist}>{view.artist}</p>
          {/* TERMINAL's own page (its DM list) thanks no one. */}
          {!sessionNamesBrand(view.artist) && (
            <p className={styles.thanks}>
              {sessionShort(view.event.session)}의 원정에 함께해 주셔서 진심으로 감사드립니다.
              <span lang="en">Thank you for joining the expedition.</span>
            </p>
          )}
          <p className={styles.lead}>{view.artist}님의 게스트 초대 페이지입니다.</p>
          <ol className={styles.guide} aria-label="초대 안내">
            <li>
              <strong>링크 보내기</strong>
              초대 링크를 복사·공유해 게스트에게 보내 주십시오.
            </li>
            <li>
              <strong>직접 등록</strong>
              게스트의 동의를 받아 직접 등록 칸에 올려도 됩니다.
            </li>
            <li>
              <strong>1인 1신청</strong>
              동반인도 각자 신청해야 합니다.
            </li>
            {!unlimited && (
              <li>
                <strong>한도 {view.limit}명</strong>
                차면 새 신청은 대기 명단으로 받습니다. 정원 추가는 TERMINAL에 요청해 주십시오.
              </li>
            )}
            <li>
              <strong>당일 입장</strong>
              신청은 이벤트 시작 전까지, 입구에서 이름으로 확인합니다.
            </li>
          </ol>
          <div className={styles.facts}>
            <Facts
              rows={[
                ['일시', `${view.event.date} ${view.event.time}`],
                ['장소', view.event.venue],
              ]}
            />
          </div>
        </Panel>
        <Panel title="초대 링크" label="Invite" surface="paper">
          <p>이 링크로 신청한 게스트는 초대인 {view.artist}의 명단에 기록됩니다.</p>
          <p className={styles.link}>{link.replace(/^https:\/\//, '')}</p>
          <div className={styles.keys}>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => { setLastKey('copy'); void copy(link); }}>
              {lastKey === 'copy' ? COPY_TEXT[state] : COPY_TEXT.idle}<small lang="en" aria-hidden="true">COPY</small>
            </button>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => { setLastKey('share'); void share(link, `${view.artist} · ${view.event.session} 게스트 초대`); }}>
              {lastKey === 'share' ? SHARE_TEXT[state] : SHARE_TEXT.idle}<small lang="en" aria-hidden="true">SHARE</small>
            </button>
          </div>
          <span className={ui.srOnly} role="status">{state === 'idle' ? '' : COPY_TEXT[state]}</span>
          <HostGuestForm artistId={artistId} token={token} open={view.open} />
        </Panel>
        <Panel title="신청 현황" label="Status" code={unlimited ? 'NO LIMIT' : `LIMIT ${view.limit}`} className={styles.status}>
          <p className={styles.count}>
            <strong>{two(view.count)}</strong>
            {!unlimited && <span> / {two(view.limit)}</span>}
            <span className={ui.srOnly}>명 신청</span>
          </p>
          {cells && (
            <div className={styles.cells} aria-hidden="true">
              {Array.from({ length: view.limit }, (_, index) => (
                <i key={index} data-used={index < view.count || undefined} />
              ))}
            </div>
          )}
          <p className={`${ui.band} ${styles.band}`} data-state={view.open ? 'open' : 'closed'}>{band}</p>
          {view.guests.length ? (
            <ol className={styles.guests} aria-label="신청한 게스트" tabIndex={0}>
              {view.guests.map((guest, index) => (
                <li key={`${guest.createdAt}-${index}`}>
                  <span>{guest.name}</span>
                  <time dateTime={guest.createdAt}>{kstStamp(guest.createdAt)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>아직 이 링크로 신청한 게스트가 없습니다.</p>
          )}
          <HostWaitlist artistId={artistId} token={token} waitlist={view.waitlist} room={view.open} full={full} />
          <p className={styles.note}>
            {unlimited
              ? '신청한 게스트의 이름과 신청 시각만 보입니다. 연락처는 TERMINAL만 확인합니다.'
              : '신청한 게스트의 이름과 신청 시각만 보입니다. 차면 새 신청은 대기 명단으로 받습니다. 정원 추가는 TERMINAL에 요청해 주십시오.'}
          </p>
          <Action href="/">TERMINAL 사이트 보기</Action>
        </Panel>
        {view.kit.length > 0 && (
          <Panel title="홍보 자료" label="Kit" surface="inset" className={styles.kitPanel}>
            <p className={styles.kitLead}>포스터와 티저 원본입니다.</p>
            <ul className={styles.kit}>
              {view.kit.map((item) => (
                <li key={item.href}>
                  {/* Previews come through the token-checked route, which an image loader cannot sign. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumb} alt="" width={480} height={Math.round((480 * item.height) / item.width)} loading="lazy" decoding="async" />
                  <span className={styles.kitLabel}>{item.label}</span>
                  <span className={styles.kitMeta}>PNG · {item.width}×{item.height} · {megabytes(item.bytes)}</span>
                  <a className={`${ui.action} ${ui.primary}`} href={item.href} download={item.download}>
                    받기<span className={ui.srOnly}> — {item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** Refusals that mean the page on screen is behind the server's (a link that no longer holds included): it reads again. */
const OUTDATED = new Set(['GUEST_LIMIT_REACHED', 'GUEST_ALREADY_LISTED', 'WAITLIST_ENTRY_NOT_FOUND', 'REQUEST_PERIOD_INACTIVE', 'INVALID_HOST_LINK']);
const outdated = (failure: unknown) => failure instanceof ApiError && OUTDATED.has(failure.code);

/**
 * The artist puts a guest on the list themselves (a friend who will not fill in a form): a name and
 * an Instagram id, on the artist's word that the guest agreed. Same limit and duplicate rules.
 */
function HostGuestForm({ artistId, token, open }: { artistId: string; token: string; open: boolean }) {
  const client = useQueryClient();
  const [fields, setFields] = useState({ name: '', instagram: '', consent: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved('');
    try {
      await postJson<{ ok: boolean }>('/api/invite/host/guests', { artistId, t: token, ...fields });
      setSaved(fields.name.trim());
      setFields({ name: '', instagram: '', consent: false });
      await client.invalidateQueries({ queryKey: ['host', artistId, token] });
    } catch (failure) {
      setError(failure);
      if (outdated(failure)) void client.invalidateQueries({ queryKey: ['host', artistId, token] });
    } finally {
      setPending(false);
    }
  }
  const errorCode = error instanceof ApiError ? error.code : '';
  return (
    <form className={`${formStyles.form} ${styles.guestForm}`} onSubmit={submit} aria-busy={pending}>
      <p className={`${ui.band} ${styles.formBand}`}>게스트 직접 등록</p>
      <FormError message={error && errorCode !== 'INVALID_INSTAGRAM_FORMAT' ? errorMessage(error) : ''} />
      <fieldset className={formStyles.fields} disabled={pending || !open}>
        <Field
          id="host-guest-name"
          label="게스트 이름"
          required
          maxLength={100}
          value={fields.name}
          onChange={(change) => setFields({ ...fields, name: change.target.value })}
        />
        <Field
          id="host-guest-instagram"
          label="인스타그램 ID"
          required
          maxLength={31}
          pattern="@[A-Za-z0-9_.]{1,30}"
          {...literalInput}
          value={`@${fields.instagram}`}
          error={errorCode === 'INVALID_INSTAGRAM_FORMAT' ? errorMessage(error) : undefined}
          onChange={(change) => {
            setFields({ ...fields, instagram: change.target.value.replace(/^@+/, '') });
            if (errorCode === 'INVALID_INSTAGRAM_FORMAT') setError(null);
          }}
        />
        <Consent
          id="host-guest-consent"
          required
          checked={fields.consent}
          onChange={(value) => setFields({ ...fields, consent: value })}
        >
          게스트 본인에게 이름과 인스타그램 ID를 TERMINAL 게스트 명단에 올린다는 동의를 받았습니다.
          보존 기간: 이벤트 종료 후 1개월.
        </Consent>
        <button aria-busy={pending} className={`${ui.button} ${ui.primary}`}>
          {pending ? '등록 중…' : open ? '게스트 등록' : '등록 마감'}
        </button>
      </fieldset>
      <p className={ui.srOnly} role="status">{saved ? `${saved} 님을 명단에 올렸습니다.` : ''}</p>
      {saved && <p className={styles.saved} aria-hidden="true">{saved} 님을 명단에 올렸습니다.</p>}
    </form>
  );
}

/**
 * Guests the limit turned away, oldest first. The artist moves one up while the list has room and
 * tells them by Instagram DM: the site sends nothing, so the id is shown (the guest agreed to that).
 */
function HostWaitlist({ artistId, token, waitlist, room, full }: {
  artistId: string;
  token: string;
  waitlist: HostView['waitlist'];
  /** Whether a guest can be moved up now: a place is left and requests are still taken. */
  room: boolean;
  full: boolean;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [moved, setMoved] = useState<{ name: string; instagram: string } | null>(null);
  async function promote(guest: HostView['waitlist'][number]) {
    if (pending) return;
    setPending(guest.id);
    setError(null);
    setMoved(null);
    try {
      await postJson<{ ok: boolean }>('/api/invite/host/waitlist', { artistId, t: token, id: guest.id });
      setMoved({ name: guest.name, instagram: guest.instagram });
      await client.invalidateQueries({ queryKey: ['host', artistId, token] });
    } catch (failure) {
      setError(failure);
      if (outdated(failure)) void client.invalidateQueries({ queryKey: ['host', artistId, token] });
    } finally {
      setPending('');
    }
  }
  const done = moved && <p className={styles.saved} aria-hidden="true">{moved.name} 님을 명단에 올렸습니다. {moved.instagram}에 DM으로 알려 주십시오.</p>;
  const status = <p className={ui.srOnly} role="status">{moved ? `${moved.name} 님을 명단에 올렸습니다.` : ''}</p>;
  // Nobody waiting: nothing to show, but the word that the last one went up stays.
  if (!waitlist.length) return <>{status}{done}</>;
  return (
    <section className={styles.waitlist} aria-label="대기 명단">
      <p className={`${ui.band} ${styles.waitBand}`}>대기 명단 {two(waitlist.length)}</p>
      <FormError message={error ? errorMessage(error) : ''} />
      <ol className={styles.waiting}>
        {waitlist.map((guest) => (
          <li key={guest.id}>
            <span className={styles.waitWho}>
              <span>{guest.name}</span>
              <a href={`https://instagram.com/${guest.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">{guest.instagram}</a>
            </span>
            <time dateTime={guest.createdAt}>{kstStamp(guest.createdAt)}</time>
            <button
              type="button"
              className={ui.button}
              aria-busy={pending === guest.id}
              disabled={!room || Boolean(pending)}
              onClick={() => void promote(guest)}
            >
              {pending === guest.id ? '올리는 중…' : '명단에 올리기'}
              <span className={ui.srOnly}> — {guest.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        {room
          ? '올린 게스트에게는 사이트가 따로 알리지 않습니다. 인스타그램 DM으로 알려 주십시오.'
          : full
            ? '정원이 차 있어 올릴 수 없습니다. 정원 추가는 TERMINAL에 요청해 주십시오.'
            : '신청 기간이 아니어서 올릴 수 없습니다.'}
      </p>
      {status}
      {done}
    </section>
  );
}
