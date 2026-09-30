'use client';
import Link from 'next/link';
import { artistHref } from '@/features/artists/model';
import { LiveValue } from '@/features/display/Display';
import { Loading, StateNotice } from '@/features/ui/Ui';
import { useStageMode } from '../usePaging';
import { ChipFace, FocusHead, PlateCard, PlateStatus, Tags } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const pad = (value: number, size = 3) => String(value).padStart(size, '0');

/**
 * The roster at every size: a chip, an index beside an open file, a summary with roster cells, or
 * the whole grid of files. The cells, lines and cards are the artists' own elements.
 */
export function ArtistsPlate({ mode, state, data, query }: PlateProps) {
  const stageMode = useStageMode();
  const profiles = data.profiles;
  const count = profiles.length;
  const failure = !data.events && (query.isError ? <StateNotice error title="아티스트 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />);

  // Until the records are read, no count is printed (a failed read is not zero records).
  const reading = data.events ? null : query.isError ? 'ERROR' : 'READ';
  const status = !data.events && (
    <PlateStatus state={query.isError ? 'error' : 'loading'} text={query.isError ? '아티스트 기록을 불러오지 못했습니다' : '아티스트 기록을 불러오는 중'} retry={() => void query.refetch()} />
  );
  if (mode === 'chip') return <ChipFace href="/artists" name="ARTISTS" title="아티스트" meta={reading ?? `${pad(count)} FILES`} />;
  if (mode !== 'hero') {
    const card = mode === 'index'
      ? <PlateCard href="/artists" label="Artists" title="전체 아티스트" tags={<Tags items={[reading ?? `${pad(count)} FILES`]} />} />
      : <PlateCard href="/artists" label="Artists" title="아티스트" tags={<Tags items={[reading ?? `${pad(count)} FILES`]} />} />;
    // Unread, the plate cannot be one link (the state line carries a retry key): its band is.
    if (!data.events) return <div className={styles.face}>{card}{status}</div>;
    if (stageMode === 'stage') return card;
    return (
      <div className={styles.face}>
        {card}
        {count > 0 && (
          <ul className={`${styles.inlineCells} ${styles.inlineRoster}`}>
            {profiles.slice(0, 10).map(profile => (
              <li key={profile.key}>
                <Link href={artistHref(profile.key)} className={`${styles.card} ${styles.artistCell}`} data-featured={profile.key === 'stann-lumo' || undefined}>
                  <span className={styles.cellName}>{profile.name}</span>
                  <span className={styles.cellMeta} aria-hidden="true">{profile.origin} · {pad(profile.appearances.length, 2)} REC</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data.events && !count && <p className={styles.empty}>공개된 아티스트 기록이 아직 없습니다.</p>}
      </div>
    );
  }

  const appearances = profiles.reduce((total, profile) => total + profile.appearances.length, 0);
  const sessions = new Set(profiles.flatMap(profile => profile.appearances.map(row => row.event.id))).size;
  const origins = [...new Set(profiles.map(profile => profile.origin || '—'))].sort();
  const page = state.view === 'plate' ? state.page : 1;
  const missing = state.view === 'plate' ? state.missing : undefined;
  return (
    <div className={styles.face}>
      <FocusHead label="Artists" title="함께한 아티스트" tags={<Tags items={reading ? [reading] : [`${pad(count)} FILES`, `PAGE ${pad(page, 2)}`]} />}>
        {missing ? (
          <p className={styles.missing} role="alert">
            <b aria-hidden="true">ERROR</b> 공개된 출연 이력이 없는 아티스트입니다. 아래 명부에서 다시 찾아 주세요.
          </p>
        ) : data.events && (
          <div className={styles.summary}>
            <dl className={styles.counts}>
              <div><dt>아티스트</dt><dd><LiveValue value={pad(count)} /></dd></div>
              <div><dt>출연 기록</dt><dd><LiveValue value={pad(appearances)} /></dd></div>
              <div><dt>참여 세션</dt><dd><LiveValue value={pad(sessions)} /></dd></div>
            </dl>
            <span className={styles.bandTags} aria-hidden="true">
              <Tags items={origins} />
            </span>
          </div>
        )}
      </FocusHead>
      {failure}
      {data.events && !count && <StateNotice title="아직 공개된 아티스트 기록이 없습니다" />}
    </div>
  );
}
