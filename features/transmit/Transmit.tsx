'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeading, Pagination, Panel } from '@/features/ui/Ui';
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
        <Panel title="기록 남기기" code="WRITE">
          <TransmitForm
            onSaved={() => {
              void client.invalidateQueries({ queryKey: ['transmit'] });
            }}
            onPosted={() => {
              if (page !== 1) router.replace('/transmit', { scroll: false });
            }}
          />
        </Panel>
        <TransmitLog page={page} query={query} />
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
      code={query.data ? `${query.data.total} RECORDS` : 'READ'}
    >
      <Feed page={page} />
      {query.data && (
        <Pagination
          page={page}
          totalPages={query.data.totalPages}
          href={(page) => `/transmit?page=${page}`}
        />
      )}
      <div
        key={query.dataUpdatedAt}
        data-readout-live=""
        className={styles.feedRule}
        aria-hidden="true"
        data-state={
          query.isFetching
            ? 'loading'
            : query.isError
              ? 'error'
              : query.data
                ? 'ready'
                : 'idle'
        }
      >
        <i />
        <i />
        <i />
      </div>
    </Panel>
  );
}
