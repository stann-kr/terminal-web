'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { HostView } from '@/lib/gate/hostView';
import { inviteHref } from '@/features/access/invite';
import { SITE_ORIGIN } from '@/features/events/metadata';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import { useShareLink, type ShareState } from '@/features/ui/share';
import { Action, Bay, BrandText, Facts, Loading, PageHeading, Panel, StateNotice, ui } from '@/features/ui/Ui';
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
  if (query.error) {
    return (
      <StateNotice error title="초대 현황을 불러오지 못했습니다" retry={() => void query.refetch()}>
        <p>{errorMessage(query.error)}</p>
      </StateNotice>
    );
  }
  if (!query.data) return <Loading />;
  return <HostPlates view={query.data} />;
}

function HostPlates({ view }: { view: HostView }) {
  const link = new URL(inviteHref(view.event.id, view.code), SITE_ORIGIN).href;
  const { state, share, copy } = useShareLink();
  // Which of the two link keys was pressed last, so only that one shows the result.
  const [lastKey, setLastKey] = useState<'copy' | 'share' | null>(null);
  const full = view.count >= view.limit;
  // The code's ceiling (TERMINAL's own list) reads as no limit; any other limit is printed.
  const unlimited = view.limit >= UNLIMITED;
  const cells = view.limit <= MAX_CELLS;
  const band = !view.open && !full ? 'CLOSED' : full ? 'FULL · INVITE CLOSED' : unlimited ? 'OPEN' : `OPEN · ${view.limit - view.count} LEFT`;
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
      <div className={styles.plates}>
        <Panel title="초대인" label="Artist" surface="feature" heading={false}>
          <p className={styles.artist}>{view.artist}</p>
          <p className={styles.lead}>
            {view.artist}님의 게스트 초대 페이지입니다. 아래 링크를 게스트에게 보내 주십시오. 게스트가
            직접 이름과 인스타그램 ID를 남기고 신청합니다.
          </p>
          <div className={styles.facts}>
            <Facts
              rows={[
                ['이벤트', view.event.session],
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
              {lastKey === 'copy' ? COPY_TEXT[state] : COPY_TEXT.idle}<small lang="en">COPY</small>
            </button>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => { setLastKey('share'); void share(link, `${view.artist} · ${view.event.session} 게스트 초대`); }}>
              {lastKey === 'share' ? SHARE_TEXT[state] : SHARE_TEXT.idle}<small lang="en">SHARE</small>
            </button>
          </div>
          <span className={ui.srOnly} role="status">{state === 'idle' ? '' : COPY_TEXT[state]}</span>
          <Bay label={`INVITE / ${view.code}`} />
        </Panel>
        <Panel title="신청 현황" label="Status" code={unlimited ? 'NO LIMIT' : `LIMIT ${view.limit}`}>
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
            <ol className={styles.guests} aria-label="신청한 게스트">
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
          <p className={styles.note}>
            {unlimited
              ? '신청한 게스트의 이름과 신청 시각만 보입니다. 연락처는 TERMINAL만 확인합니다.'
              : '한도가 차면 링크는 마감 안내로 바뀝니다. 더 필요하면 TERMINAL에 요청해 주십시오.'}
          </p>
          <Action href="/">TERMINAL 사이트 보기</Action>
        </Panel>
      </div>
    </div>
  );
}
