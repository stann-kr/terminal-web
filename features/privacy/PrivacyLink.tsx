import { ui } from '@/features/ui/Ui';

/** The way to the privacy policy from a form's notice, in a new tab so what was typed stays. */
export function PrivacyLink() {
  return (
    <a href="/privacy" target="_blank" rel="noopener">
      개인정보처리방침<span className={ui.srOnly}> (새 탭)</span>
    </a>
  );
}
