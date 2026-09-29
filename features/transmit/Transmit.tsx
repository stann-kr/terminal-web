'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bay, Facts, PageHeading, Pagination, Panel } from '@/features/ui/Ui';
import { pageNumber } from '@/features/events/model';
import { TransmitForm } from './TransmitForm';
import { Feed, useTransmit } from './Feed';
import styles from './transmit.module.css';
export function Transmit() {
  const params = useSearchParams(),
    router = useRouter(),
    client = useQueryClient();
  const page = pageNumber(params.get('page')),
    query = useTransmit(page);
  return (
    <>
      <PageHeading title="방문자 로그" />
      <div className={styles.layout}>
        <div className={styles.column}>
          <Panel title="기록 남기기" label="Write log" surface="sand" className={styles.write}>
            <TransmitForm
              onSaved={() => {
                void client.invalidateQueries({ queryKey: ['transmit'] });
              }}
              onPosted={() => {
                if (page !== 1) router.replace('/transmit', { scroll: false });
              }}
            />
            <Bay label="VISITOR LOG / PUBLIC" />
          </Panel>
        </div>
        <TransmitLog page={page} query={query} />
        <Panel title="로그 현황" label="Log status" surface="cream" className={styles.statusPlate}>
          <Facts
            rows={[
              ['전체 기록', query.data ? String(query.data.total).padStart(3, '0') : '—'],
              ['페이지', query.data ? `${page} / ${Math.max(query.data.totalPages, 1)}` : '—'],
              ['최근 기록', query.data?.logs[0] ? `${query.data.logs[0].ts} KST` : '—'],
            ]}
          />
          <Bay label="PUBLIC RECORD / KST" />
        </Panel>
      </div>
    </>
  );
}

export { TransmitForm } from './TransmitForm';

function TransmitLog({
  page,
  query,
}: {
  page: number;
  query: ReturnType<typeof useTransmit>;
}) {
  return (
    <Panel
      title="공개 로그"
      label="Public log"
      code={query.data ? `${query.data.total} RECORDS` : 'READ'}
      surface="sage"
    >
      <Feed page={page} />
      {query.data && (
        <Pagination
          page={page}
          totalPages={query.data.totalPages}
          href={(page) => `/transmit?page=${page}`}
        />
      )}
      <FeedState
        key={query.dataUpdatedAt}
        state={
          query.isFetching
            ? 'loading'
            : query.isError
              ? 'error'
              : query.data
                ? 'ready'
                : 'idle'
        }
      />
    </Panel>
  );
}

const feedStateLabel = {
  loading: 'READING LOG',
  error: 'READ FAILED',
  ready: 'LOG CURRENT',
  idle: 'STANDBY',
} as const;

/** Real query state of the public log; blinks only while a request is pending. */
function FeedState({ state }: { state: keyof typeof feedStateLabel }) {
  return (
    <p className={styles.feedRule} aria-hidden="true" data-state={state}>
      <i />
      {feedStateLabel[state]}
    </p>
  );
}
