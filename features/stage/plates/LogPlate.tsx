'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TRANSMIT_PAGE_SIZE } from '@/lib/transmit/contract';
import { useTransmit, useTransmitRange } from '@/features/transmit/useTransmit';
import { NodeActivity } from '@/features/transmit/NodeActivity';
import { TransmitForm } from '@/features/transmit/TransmitForm';
import { Loading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { packHeights } from '../text';
import { pageAnnouncement, pageKey, pageReadout, useStageMode, useWheelPaging } from '../usePaging';
import { CardLink, ChipFace, FocusHead, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const pad = (value: number, size = 3) => String(value).padStart(size, '0');
/** Height of one node row on the home plate, gap included (px). */
const NODE_ROW = 46;
const logHref = (page: number) => `/transmit${page > 1 ? `?page=${page}` : ''}`;
/** A usual log entry's height (handle line and one line of message) and the pager and state line under the list, px. */
const LOG_ROW = 84;
const LOG_CHROME = 96;
/** Most entries one page of the open log holds. */
const LOG_MAX = 30;

/** The visitor log: node activity on the home, the write form and the public log when open. */
export function LogPlate({ mode, state, size }: PlateProps) {
  const summary = useTransmit(1);
  const total = summary.data?.total;
  const meta = total !== undefined ? `${pad(total)} REC` : summary.isError ? 'ERROR' : 'READ';
  if (mode === 'chip' || mode === 'index') return <ChipFace href="/transmit" name="LOG" title="방문자 로그" meta={meta} />;
  if (mode !== 'hero') {
    // As many node rows as the plate has room for, below its band. The plate is one link.
    const limit = size ? Math.max(1, Math.min(6, Math.floor((size.h - 110) / NODE_ROW))) : 6;
    return (
      <CardLink href="/transmit" className={styles.summaryCard} label={`방문자 로그 · ${meta}`}>
        <span className={styles.band}>
          <span className={styles.bandTitle}>
            <span className={styles.bandLabel}>Log</span>
            <span className={styles.bandKo}>방문자 로그</span>
          </span>
          <span className={styles.bandTags}><Tags items={['NODE ACTIVITY']} /></span>
        </span>
        <span className={styles.cardBody} aria-hidden="true">
          <NodeActivity limit={limit} quiet />
        </span>
      </CardLink>
    );
  }
  return <LogFocus page={state.view === 'plate' ? state.page : 1} />;
}

function LogFocus({ page }: { page: number }) {
  const router = useRouter();
  const client = useQueryClient();
  // How many entries a page holds follows the room the public log has (LogPages measures it).
  const [capacity, setCapacity] = useState(TRANSMIT_PAGE_SIZE);
  const query = useTransmitRange((page - 1) * capacity, capacity);
  const newest = useTransmit(1);
  const latest = newest.data?.logs[0];
  const total = query.data?.total ?? newest.data?.total;
  const totalPages = total === undefined ? 1 : Math.max(1, Math.ceil(total / capacity));
  return (
    <div className={styles.face}>
      <FocusHead label="Log" title="방문자 로그" tags={<Tags items={[total !== undefined ? `${pad(total)} RECORDS` : 'READ', latest ? `LAST ${latest.ts} KST` : null]} />} />
      <div className={styles.logGrid}>
        <Panel title="기록 남기기" label="Write log" surface="fresh" className={styles.logWrite}>
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
        <Panel title="공개 로그" label="Public log" code={total !== undefined ? `${total} RECORDS` : 'READ'} surface="panel" className={styles.logPublic}>
          <LogPages page={page} capacity={capacity} totalPages={totalPages} query={query} onCapacity={setCapacity} />
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
 * The drawn log list cut into sub-pages that fit its height. Stacked under the write form (a narrow
 * plate), the log is read by scrolling instead: the whole server page shows at once and a spill
 * grows the sheet, rather than cutting it into one-entry pages.
 */
function cutLog(list: HTMLElement) {
  const entries = [...list.children];
  const grid = list.closest<HTMLElement>(`.${styles.logGrid}`);
  if (grid && getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length === 1) return [entries.map((_, index) => index)];
  const heights = entries.map(child => child.getBoundingClientRect().height);
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  return packHeights(heights, list.clientHeight, gap);
}

/**
 * One page of the public log, as many entries as the panel has room for (read from the server's
 * pages of five). On the stage, entries that still do not fit are split into sub-pages by their
 * measured height; turning past the last sub-page moves to the next page, so the reader never meets
 * a scrollbar or a cut entry. When the room changes, so does the page size, and the page is chosen
 * again so that the entry at the top stays in view.
 */
function LogPages({ page, capacity, totalPages, query, onCapacity }: {
  page: number;
  capacity: number;
  totalPages: number;
  query: ReturnType<typeof useTransmitRange>;
  onCapacity: (capacity: number) => void;
}) {
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
    setSplit({ key: `${logKey}:${stageMode}`, pages: cutLog(element) });
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

  const subCount = pages?.length ?? 1;
  const index = sub.key === logKey ? Math.min(sub.index, subCount - 1) : 0;

  // The page size follows the room: entries of a usual height that fit under the list's head (a taller
  // one goes to a sub-page). Stacked under the form, the log scrolls and keeps the server's five.
  const at = useRef({ page, capacity, first: 0 });
  useEffect(() => {
    at.current = { page, capacity, first: pages?.[index]?.[0] ?? 0 };
  });
  useEffect(() => {
    const element = region.current;
    if (stageMode !== 'stage' || !element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      if (!element.clientHeight) return;
      const grid = element.closest<HTMLElement>(`.${styles.logGrid}`);
      const stacked = !!grid && getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length === 1;
      const fits = Math.max(1, Math.min(LOG_MAX, Math.floor((element.clientHeight - LOG_CHROME) / LOG_ROW)));
      const next = stacked ? TRANSMIT_PAGE_SIZE : fits;
      const { page: current, capacity: was, first } = at.current;
      if (next === was) return;
      // Keep the entry at the top of what is shown on the page that now holds it.
      const target = Math.floor(((current - 1) * was + first) / next) + 1;
      onCapacity(next);
      if (target !== current) router.replace(logHref(target), { scroll: false });
    };
    // The first reading applies at once; later ones wait for the window to hold still.
    let first = true;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      if (first) {
        first = false;
        measure();
      } else timer = window.setTimeout(measure, 150);
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [stageMode, onCapacity, router]);
  // An address past the last page (the log got shorter, or pages got larger) shows the last one.
  const read = !!query.data;
  useEffect(() => {
    if (read && page > totalPages) router.replace(logHref(totalPages), { scroll: false });
  }, [read, page, totalPages, router]);

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
