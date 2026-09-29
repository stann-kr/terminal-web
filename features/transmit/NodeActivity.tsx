'use client';
import { Loading, StateNotice } from '@/features/ui/Ui';
import { useTransmit } from './Feed';
import styles from './transmit.module.css';

/** A stable four-character node tag derived from a log id; it never exposes the handle. */
export function nodeTag(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return `NODE-${hash.toString(16).toUpperCase().padStart(8, '0').slice(-4)}`;
}

/**
 * Recent public-log activity as node records: when a node left a record, without the message
 * or the public handle, so the home screen never surfaces free text from visitors.
 */
export function NodeActivity({ limit = 6 }: { limit?: number }) {
  const query = useTransmit(1);
  if (!query.data)
    return query.isError ? (
      <StateNotice error title="접속 기록 조회 실패" retry={() => void query.refetch()} />
    ) : (
      <Loading />
    );
  const logs = query.data.logs.slice(0, limit);
  if (!logs.length) return <p className={styles.nodeEmpty}>아직 기록된 노드가 없습니다.</p>;
  return (
    <ol className={styles.nodes}>
      {logs.map((log) => (
        <li key={log.id}>
          <time dateTime={log.createdAt}>{log.ts} KST</time>
          <b>{nodeTag(log.id)}</b>
          <span>LOGGED</span>
        </li>
      ))}
    </ol>
  );
}
