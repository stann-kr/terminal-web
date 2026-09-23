import { Action, PageHeading, StateNotice, ui } from '@/features/ui/Ui';
export default function NotFound() { return <><PageHeading code="404 / NOT FOUND" title="이 주소의 기록을 찾을 수 없습니다"/><StateNotice error title="페이지가 없거나 주소가 바뀌었습니다"><p>행사 목록이나 홈에서 다시 탐색할 수 있습니다.</p><div className={ui.actions}><Action primary href="/">홈으로</Action><Action href="/events">행사 목록</Action></div></StateNotice></>; }
