'use client';
import { useEvents } from '@/features/events/data';
import { accessAvailability, eventHref } from '@/features/events/model';
import { EventFacts } from '@/features/events/EventRecord';
import {
  Action,
  Loading,
  PageHeading,
  Panel,
  StateNotice,
  ui,
} from '@/features/ui/Ui';
import { FormPanel } from '@/features/ui/Form';
import { AccessForm } from './AccessForm';
import styles from './access.module.css';

export function Access({ eventId }: { eventId: string }) {
  const query = useEvents();
  const event = query.events?.find((event) => event.id === eventId);
  const availability =
    event && !query.isError
      ? accessAvailability(event, query.events!, query.now)
      : {
          canRequest: false,
          message: query.isPending
            ? '행사 정보를 확인하고 있습니다.'
            : query.isError
              ? '최신 행사 정보를 확인한 뒤 다시 시도해 주세요.'
              : '신청할 공개 행사 기록을 찾을 수 없습니다.',
        };
  return (
    <>
      <PageHeading title="게스트 신청" />
      <div className={styles.layout} data-fetching={query.isFetching}>
        <AccessEventSummary eventId={eventId} query={query} />
        <FormPanel title="게스트 신청서" code="ACCESS">
          <AccessForm
            key={eventId}
            eventId={eventId}
            availability={availability}
          />
        </FormPanel>
      </div>
    </>
  );
}

export { AccessForm } from './AccessForm';

function AccessEventSummary({
  eventId,
  query,
}: {
  eventId: string;
  query: ReturnType<typeof useEvents>;
}) {
  const event = query.events?.find((event) => event.id === eventId);
  return (
    <Panel title={event?.session ?? '행사 정보'} label="Session" code={eventId} surface="navy">
      {query.isError && (
        <StateNotice
          error
          title="행사 정보를 불러오지 못했습니다"
          retry={() => void query.refetch()}
        />
      )}
      {event ? (
        <>
          <EventFacts event={event} />
          <div className={ui.actions}>
            <Action href={eventHref(event.id)}>행사 상세</Action>
          </div>
        </>
      ) : query.isPending ? (
        <Loading />
      ) : (
        !query.isError && (
          <StateNotice error title="신청할 행사를 찾을 수 없습니다">
            <Action href="/events">행사 목록 확인</Action>
          </StateNotice>
        )
      )}
    </Panel>
  );
}
