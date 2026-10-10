'use client';
import { usePathname } from 'next/navigation';
import { stageStateFromUrl } from '@/features/stage/state';
import { Action, PageHeading, StateNotice, ui } from '@/features/ui/Ui';

/**
 * A missing session or artist is a 404 that the stage shows itself, as a notice in the open
 * directory, so nothing is added there. Any other unknown address gets this page off the stage.
 */
export default function NotFound() {
  const view = stageStateFromUrl(usePathname()).view;
  if (view !== 'none') return null;
  return <><PageHeading title="이 주소의 기록을 찾을 수 없습니다"/><StateNotice error title="페이지가 없거나 주소가 바뀌었습니다"><p>이벤트 목록이나 홈에서 다시 탐색할 수 있습니다.</p><div className={ui.actions}><Action primary href="/">홈으로</Action><Action href="/events">이벤트 목록</Action></div></StateNotice></>;
}
