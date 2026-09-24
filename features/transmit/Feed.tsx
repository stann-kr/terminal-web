'use client';
import { useQuery } from '@tanstack/react-query';
import type { TransmitLogPage } from '@/lib/transmit/contract';
import { requestJson } from '@/features/ui/http';
import { Loading, StateNotice, ui } from '@/features/ui/Ui';
import styles from './transmit.module.css';
export function useTransmit(page: number) { return useQuery({ queryKey: ['transmit',page], queryFn: ({ signal }) => requestJson<TransmitLogPage>(`/api/transmit?page=${page}`, { signal }) }); }
export function Feed({ page = 1, limit }: { page?: number; limit?: number }) {
  const query = useTransmit(page);
  if (!query.data) return query.isError ? <StateNotice error title="방문자 로그 조회 실패" retry={() => void query.refetch()}>잠시 후 다시 확인해 주세요.</StateNotice> : <Loading/>;
  return <div className={styles.console}>{query.isError && <StateNotice error title="로그를 갱신하지 못했습니다" retry={() => void query.refetch()}>마지막 확인된 내용을 표시합니다.</StateNotice>}{!query.data.logs.length ? <p className={ui.muted}>{page > 1 ? '이 페이지에 남아 있는 글이 없습니다.' : '아직 남겨진 글이 없습니다.'}</p> : <ol className={styles.logs}>{query.data.logs.slice(0,limit).map(log => <li key={log.id}><header><strong>{log.handle}</strong><time dateTime={log.createdAt}>{log.ts} KST</time></header><p>{log.message}</p></li>)}</ol>}<span className={styles.consoleMark} aria-hidden="true"/></div>;
}
