'use client';
import { useEvents } from '@/features/events/data';
import { accessAvailability } from '@/features/events/model';
import { FormPanel } from '@/features/ui/Form';
import { AccessForm } from './AccessForm';

export { AccessForm } from './AccessForm';

/** The guest request form with the availability the event allows right now. */
export function AccessRequest({ eventId }: { eventId: string }) {
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
    <FormPanel title="게스트 신청서" code="ACCESS">
      <AccessForm key={eventId} eventId={eventId} event={event} availability={availability} />
    </FormPanel>
  );
}

