"use client";

import { useEffect, useRef } from 'react';
import { useLang } from '@/lib/langContext';
import { useSignalSubscription } from './useSignalSubscription';
import { Action } from '@/features/terminal/shared/Ui';
import { FormField } from '@/features/terminal/forms/FormField';
import { TerminalText } from '@/features/terminal/motion/TerminalText';
import { PendingIndicator } from '@/features/terminal/motion/PendingIndicator';
import { useReadoutMotion } from '@/features/terminal/motion/useReadoutMotion';

export default function SignalPage() {
  const { lang } = useLang();
  const signal = useSignalSubscription();
  const { t, form, fieldErrors, isSubmitting, submitted, formError } = signal;
  const tr = (ko: string, en: string) => lang === 'ko' ? ko : en;
  const inputRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  useReadoutMotion(inputRef, { key: `${lang}:${submitted}:${formError}:${Object.values(fieldErrors).join(',')}`, contentKey: lang, content: ':scope', updates: '.tm-contact-result,.tm-field-error,.tm-form-hint', layout: true });
  useEffect(() => { if (submitted) resultRef.current?.focus(); }, [submitted]);
  return <div className="tm-contact-grid" data-kind="signal">
    <section className="tm-contact-context tm-cell"><p className="tm-eyebrow">TERMINAL / SIGNAL</p><h2 data-view-title data-motion-title tabIndex={-1}><TerminalText>{'EVENT\nUPDATES'}</TerminalText></h2><div data-motion-copy className="tm-contact-context-bottom"><h2>{tr('이벤트 소식 받기', 'Get event updates')}</h2><div className="tm-prose">{t.signal.description.map(line => <p key={line}>{line}</p>)}</div></div></section>
    <section data-readout-region ref={inputRef} className="tm-contact-input tm-cell">
      {submitted ? <div className="tm-contact-result"><p className="tm-eyebrow">{tr('접수 결과', 'SUBSCRIPTION RECEIVED')}</p><h2 ref={resultRef} tabIndex={-1}><TerminalText>{tr('소식 신청 완료', 'Subscription received')}</TerminalText></h2><p>{t.signal.committedSub}</p><p>{form.email}</p><Action page="home">{tr('이벤트로 돌아가기', 'Back to event')}</Action></div> : <form className="tm-contact-form" onSubmit={signal.handleSubmit} noValidate aria-busy={isSubmitting}>
        <h2 className="tm-eyebrow">{tr('연락처 등록', 'CONTACT DETAILS')}</h2>
        <fieldset className="tm-contact-fields" disabled={isSubmitting} data-motion-controls><legend className="tm-sr-only">{tr('연락처와 동의', 'Contact and consent')}</legend>
          <FormField id="signal-email" label={tr('이메일', 'Email')} error={fieldErrors.email}><input id="signal-email" name="email" type="email" value={form.email} onChange={signal.handleEmailChange} autoComplete="email" required maxLength={254} placeholder="you@example.com" spellCheck={false} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'signal-email-error' : undefined} /></FormField>
          <FormField id="signal-instagram" label={tr('인스타그램 ID', 'Instagram ID')} error={fieldErrors.instagram}><input id="signal-instagram" name="instagram" value={form.instagram} onChange={signal.handleInstagramChange} autoComplete="off" autoCapitalize="none" required maxLength={31} placeholder="@username" spellCheck={false} aria-invalid={Boolean(fieldErrors.instagram)} aria-describedby={fieldErrors.instagram ? 'signal-instagram-error' : undefined} /></FormField>
          <div className="tm-consent"><label htmlFor="signal-consent"><input id="signal-consent" name="consent" type="checkbox" required checked={form.consent} onChange={e => signal.handleConsentChange(e.target.checked)} aria-invalid={Boolean(fieldErrors.consent)} aria-describedby={fieldErrors.consent ? 'signal-consent-error' : undefined} /><span>{t.signal.consentLabel}</span></label>{fieldErrors.consent && <p className="tm-field-error" role="alert" id="signal-consent-error">{fieldErrors.consent}</p>}</div>
        </fieldset>
        {formError && <p className="tm-field-error" role="alert">{formError}</p>}
        <button className="tm-action tm-submit" disabled={isSubmitting} aria-busy={isSubmitting} type="submit"><span>{isSubmitting ? tr('처리 중…', 'Processing…') : tr('소식 신청', 'Subscribe')}</span>{isSubmitting && <PendingIndicator active />}</button>
      </form>}
    </section>
  </div>;
}
