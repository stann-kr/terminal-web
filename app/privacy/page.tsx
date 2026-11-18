import type { Metadata } from 'next';
import { PrivacyPage } from '@/features/privacy/PrivacyPage';

export const metadata: Metadata = { title: '개인정보처리방침' };

/** The privacy policy, off the stage: what each form keeps, why, for how long, and who to ask. */
export default function Page() {
  return <PrivacyPage />;
}
