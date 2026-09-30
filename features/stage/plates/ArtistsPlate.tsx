'use client';
import Link from 'next/link';
import { artistHref } from '@/features/artists/model';
import { LiveValue } from '@/features/display/Display';
import { Loading, StateNotice } from '@/features/ui/Ui';
import { useStageMode } from '../usePaging';
import { FocusHead, RailFace, StripFace, Tags, TileHead } from './faces';
import type { PlateProps } from './Plates';
import styles from './plates.module.css';

const pad = (value: number, size = 3) => String(value).padStart(size, '0');

/** The roster: names on the home, the grid of files when open, a strip over an open file. */
export function ArtistsPlate({ mode, state, data, query }: PlateProps) {
  const stageMode = useStageMode();
  const profiles = data.profiles;
  const count = profiles.length;
  if (mode === 'rail') return <RailFace href="/artists" name="ARTISTS" title="아티스트" meta={`${pad(count)} FILES`} />;
  if (mode === 'strip') return <StripFace href="/artists" label="Artists" title="함께한 아티스트" meta={`${pad(count)} FILES`} back="전체 아티스트" />;

  if (mode === 'tile') {
    return (
      <div className={styles.tile}>
        <TileHead href="/artists" label="Artists" title="아티스트" chips={<Tags items={[`${pad(count)} FILES`]} />} />
        {!data.events && (query.isError ? <StateNotice error title="아티스트 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />)}
        {stageMode !== 'stage' && count > 0 && (
          <ul className={`${styles.inlineCells} ${styles.inlineRoster}`}>
            {profiles.slice(0, 8).map(profile => (
              <li key={profile.key}>
                <Link href={artistHref(profile.key)} className={styles.artistCell} data-featured={profile.key === 'stann-lumo' || undefined}>
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
    <div className={`${styles.focus} ${styles.listFocus}`}>
      <FocusHead label="Artists" title="함께한 아티스트" chips={<Tags items={[`${pad(count)} FILES`, `PAGE ${pad(page, 2)}`]} />}>
        {missing ? (
          <p className={styles.missing} role="alert">
            <b aria-hidden="true">ERROR</b> 공개된 출연 이력이 없는 아티스트입니다. 아래 명부에서 다시 찾아 주세요.
          </p>
        ) : (
          <div className={styles.summary}>
            <dl className={styles.counts}>
              <div><dt>아티스트</dt><dd><LiveValue value={pad(count)} /></dd></div>
              <div><dt>출연 기록</dt><dd><LiveValue value={pad(appearances)} /></dd></div>
              <div><dt>참여 세션</dt><dd><LiveValue value={pad(sessions)} /></dd></div>
            </dl>
            <span className={styles.summaryTags} aria-hidden="true">
              <Tags items={origins} />
            </span>
          </div>
        )}
      </FocusHead>
      {!data.events && (query.isError ? <StateNotice error title="아티스트 기록을 불러오지 못했습니다" retry={() => void query.refetch()} /> : <Loading />)}
      {data.events && !count && <StateNotice title="아직 공개된 아티스트 기록이 없습니다" />}
    </div>
  );
}
