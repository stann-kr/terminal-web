'use client';

import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { useEventScreen } from './useEventScreen';
import { Gate, Home } from './EventScreens';
import { ArtistArchive } from '../artists/ArtistArchive';
import { Lineup } from '../lineup/Lineup';
import { EventArchive } from './EventArchive';
import { NoEvent, PageHeading, PagePending } from '../shared/Ui';

export function EventScreen({ page }: { page: 'home' | 'gate' | 'lineup' | 'status' | 'artists' }) {
  const { props, phase, refetch, eventId } = useEventScreen();
  const [artistId] = useUrlQueryState('artist');
  const { t, event } = props;
  if (phase === 'loading') return <PagePending code={page.toUpperCase()} t={t} />;
  if (phase === 'error') return <section className="tm-empty">
    <PageHeading code={`${page.toUpperCase()} / LOAD ERROR`} title={t('정보를 불러오지 못했습니다.', 'Could not load information.')} afterglow={false} />
    <p role="alert">{t('정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.', 'Could not load information. Check your connection and try again.')}</p>
    <button type="button" className="tm-button" onClick={() => void refetch()}>{t('다시 시도', 'Retry')}</button>
  </section>;
  if (page === 'artists') return <ArtistArchive {...props} />;
  if (page === 'status') return <EventArchive {...props} />;
  if (eventId && !event) return <NoEvent t={t} invalid />;
  if (page === 'lineup') return <Lineup {...props} artistId={artistId || null} />;
  if (page === 'gate') return <Gate {...props} poster={event?.posterUrl ?? ''} />;
  return <Home {...props} poster={event?.posterUrl ?? ''} />;
}
