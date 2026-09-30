'use client';
import { Loading, StateNotice } from '@/features/ui/Ui';
import { useTransmit } from './useTransmit';
import { isNodeName, nodeNameOf } from './nodeIdentity';
import styles from './transmit.module.css';

/** The node that left a record: its own node name, or one derived from the log id for a chosen nickname. */
const nodeTag = (log: { id: string; handle: string }) => (isNodeName(log.handle) ? log.handle : nodeNameOf(log.id));

/**
 * Recent public-log activity as node records, newest first: which node left a record, without
 * the time, the message or a chosen nickname, so the home screen never surfaces free text from visitors.
 */
export function NodeActivity({ limit = 6, quiet = false }: { limit?: number; quiet?: boolean }) {
  const query = useTransmit(1);
  // Quiet (inside a plate that is one link): a failed read is one line, with no key of its own.
  if (!query.data && quiet && query.isError) return <p className={styles.nodeEmpty}>접속 기록을 불러오지 못했습니다</p>;
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
          <b>{nodeTag(log)}</b>
          <span>LOGGED</span>
        </li>
      ))}
    </ol>
  );
}
