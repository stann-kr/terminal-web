'use client';
import { Action, PageHeading, StateNotice } from '@/features/ui/Ui';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <><PageHeading title="화면을 열지 못했습니다"/><StateNotice error title="일시적인 오류가 발생했습니다" retry={reset}><p>다시 불러오거나 홈으로 돌아가 주세요.</p><Action href="/">홈으로</Action></StateNotice></>; }
