'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTransmit } from '@/features/transmit/useTransmit';
import { NodeActivity } from '@/features/transmit/NodeActivity';
import { TransmitForm } from '@/features/transmit/TransmitForm';
import { Loading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { packHeights } from '../text';
import { pageAnnouncement, pageKey, pageReadout, useStageMode, useWheelPaging } from '../usePaging';
import { FocusHead, RailFace, Tags, TileHead } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const pad = (value: number, size = 3) => String(value).padStart(size, '0');
/** Height of one node row on the home plate, gap included (px). */
const NODE_ROW = 46;
const logHref = (page: number) => `/transmit${page > 1 ? `?page=${page}` : ''}`;

/** The visitor log: node activity on the home, the write form and the public log when open. */
export function LogPlate({ mode, state, size }: PlateProps) {
  const total = useTransmit(1).data?.total;
  if (mode === 'rail' || mode === 'strip') return <RailFace href="/transmit" name="LOG" title="방문자 로그" meta={total === undefined ? 'READ' : `${pad(total)} REC`} />;
  if (mode === 'tile') {
    // As many node rows as the plate has room for, below its head.
    const limit = size ? Math.max(1, Math.min(6, Math.floor((size.h - 120) / NODE_ROW))) : 6;
    return (
      <div className={styles.tile}>
        <TileHead href="/transmit" label="Log" title="방문자 로그" chips={<Tags items={['NODE ACTIVITY']} />} />
        <div className={styles.tileBody}>
          <NodeActivity limit={limit} />
        </div>
      </div>
    );
  }
  return <LogFocus page={state.view === 'plate' ? state.page : 1} />;
}

function LogFocus({ page }: { page: number }) {
  const router = useRouter();
  const client = useQueryClient();
  const query = useTransmit(page);
  const latest = query.data?.logs[0];
  return (
    <div className={styles.focus}>
      <FocusHead label="Log" title="방문자 로그" chips={<Tags items={[query.data ? `${pad(query.data.total)} RECORDS` : 'READ', latest ? `LAST ${latest.ts} KST` : null]} />} />
      <div className={styles.logGrid}>
        <Panel title="기록 남기기" label="Write log" surface="gold" className={styles.logWrite}>
          <div className={styles.fitColumn} data-fit="">
            <TransmitForm
              onSaved={() => {
                void client.invalidateQueries({ queryKey: ['transmit'] });
              }}
              onPosted={() => {
                if (page !== 1) router.replace('/transmit', { scroll: false });
              }}
            />
          </div>
        </Panel>
        <Panel title="공개 로그" label="Public log" code={query.data ? `${query.data.total} RECORDS` : 'READ'} surface="navy" className={styles.logPublic}>
          <LogPages page={page} query={query} />
        </Panel>
      </div>
    </div>
  );
}

const feedStateLabel = {
  loading: 'READING LOG',
  error: 'READ FAILED',
  ready: 'LOG CURRENT',
  idle: 'STANDBY',
} as const;

/**
 * One server page of the public log (five entries). On the stage, entries that do not fit the
 * panel are split into sub-pages by their measured height; turning past the last sub-page moves to
 * the next server page, so the reader never meets a scrollbar or a cut entry.
 */
function LogPages({ page, query }: { page: number; query: ReturnType<typeof useTransmit> }) {
  const router = useRouter();
  const stageMode = useStageMode();
  const list = useRef<HTMLOListElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const logs = query.data?.logs;
  const logKey = logs?.map(log => log.id).join() ?? '';
  const [split, setSplit] = useState<{ key: string; pages: number[][] } | null>(null);
  const [sub, setSub] = useState({ key: '', index: 0 });

  // Everything is drawn once, measured, then cut: a stale cut (other entries or another size) is dropped.
  const pages = split?.key === `${logKey}:${stageMode}` ? split.pages : null;
  useLayoutEffect(() => {
    const element = list.current;
    if (stageMode !== 'stage' || pages || !element || !logs?.length) return;
    const heights = [...element.children].map(child => child.getBoundingClientRect().height);
    const gap = parseFloat(getComputedStyle(element).rowGap) || 0;
    setSplit({ key: `${logKey}:${stageMode}`, pages: packHeights(heights, element.clientHeight, gap) });
  }, [stageMode, pages, logs, logKey]);
  useEffect(() => {
    const element = list.current;
    if (stageMode !== 'stage' || !element || typeof ResizeObserver === 'undefined') return;
    let width = element.clientWidth;
    let height = element.clientHeight;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width && element.clientHeight === height) return;
      width = element.clientWidth;
      height = element.clientHeight;
      setSplit(null);
    });
    observer.observe(element);
    let live = true;
    document.fonts?.ready.then(() => live && setSplit(null));
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [stageMode, logKey]);

  const totalPages = query.data?.totalPages ?? 1;
  const subCount = pages?.length ?? 1;
  const index = sub.key === logKey ? Math.min(sub.index, subCount - 1) : 0;
  const shown = pages ? pages[index].map(i => logs![i]) : logs ?? [];
  const prev = index > 0 ? () => setSub({ key: logKey, index: index - 1 }) : page > 1 ? () => router.push(logHref(page - 1), { scroll: false }) : undefined;
  const next = index < subCount - 1 ? () => setSub({ key: logKey, index: index + 1 }) : page < totalPages ? () => router.push(logHref(page + 1), { scroll: false }) : undefined;
  useWheelPaging(region, { prev, next }, stageMode === 'stage');

  const state = query.isFetching ? 'loading' : query.isError ? 'error' : query.data ? 'ready' : 'idle';
  return (
    <div
      ref={region}
      className={styles.logPages}
      data-pages=""
      onKeyDown={event => {
        const key = pageKey(event.nativeEvent);
        const turn = key === 'prev' ? prev : key === 'next' ? next : undefined;
        if (!turn) return;
        event.preventDefault();
        turn();
      }}
    >
      {!query.data ? (
        query.isError ? (
          <StateNotice error title="방문자 로그 조회 실패" retry={() => void query.refetch()}>잠시 후 다시 확인해 주세요.</StateNotice>
        ) : (
          <Loading />
        )
      ) : (
        <>
          {query.isError && (
            <StateNotice error title="로그를 갱신하지 못했습니다" retry={() => void query.refetch()}>
              마지막 확인된 내용을 표시합니다.
            </StateNotice>
          )}
          {!query.data.logs.length ? (
            <p className={ui.muted}>{page > 1 ? '이 페이지에 남아 있는 글이 없습니다.' : '아직 남겨진 글이 없습니다.'}</p>
          ) : (
            <ol ref={list} className={styles.logList} data-busy={query.isFetching} data-fit="">
              {shown.map(log => (
                <li key={log.id}>
                  <header>
                    <time dateTime={log.createdAt}>{log.ts} KST</time>
                    <strong>{log.handle}</strong>
                  </header>
                  <p>{log.message}</p>
                </li>
              ))}
            </ol>
          )}
          <nav className={styles.logPager} aria-label="로그 쪽 이동">
            {prev ? <button type="button" onClick={prev}>← 이전</button> : <span>이전</span>}
            <span aria-hidden="true">
              {pageReadout(page, Math.max(totalPages, 1))}
              {subCount > 1 && ` · ${index + 1}/${subCount}`}
            </span>
            <span className={ui.srOnly} aria-live="polite">
              {pageAnnouncement(page, Math.max(totalPages, 1))}
              {subCount > 1 ? `, 나눈 쪽 ${subCount}쪽 중 ${index + 1}쪽` : ''}
            </span>
            {next ? <button type="button" onClick={next}>다음 →</button> : <span>다음</span>}
          </nav>
        </>
      )}
      <p className={styles.feedRule} aria-hidden="true" data-state={state}>
        <i />
        {feedStateLabel[state]}
      </p>
    </div>
  );
}
