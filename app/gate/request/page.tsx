"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAccessRequest } from './useAccessRequest';
import { Action, EventState, PagePending } from '@/features/terminal/shared/Ui';
import { FormField } from '@/features/terminal/forms/FormField';
import { TerminalText } from '@/features/terminal/motion/TerminalText';
import { PendingIndicator } from '@/features/terminal/motion/PendingIndicator';
import { useReadoutMotion } from '@/features/terminal/motion/useReadoutMotion';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';

export default function RequestAccessPage() {
  const request = useAccessRequest();
  const { t, lang, event, eventState, form, fieldErrors, codeState, isCodeVerified, codeError, codeStatus,
    needsTargetReview, isRefreshingEvent, nextEvent, submitted, isSubmitting, formError, invitationLines } = request;
  const tr = (ko: string, en: string) => lang === 'ko' ? ko : en;
  const pending = !submitted && eventState.kind === 'loading';
  const closed = !submitted && (eventState.kind === 'load-error' || eventState.kind === 'empty' || (eventState.kind === 'inactive' && !needsTargetReview) || (eventState.kind === 'target-changed' && !nextEvent && !isRefreshingEvent));
  const pageStage = pending ? 'loading' : closed ? 'closed' : 'form';
  const pageRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  useReadoutMotion(pageRef, { key: `${lang}:${event?.id}:${pageStage}`, content: ':scope', layout: true });
  useReadoutMotion(inputRef, {
    key: `${lang}:${event?.id}:${eventState.kind}:${needsTargetReview}:${submitted}:${codeState.kind}:${codeError}:${formError}:${Object.values(fieldErrors).join(',')}`,
    contentKey: `${lang}:${event?.id}:${eventState.kind}`, content: ':scope',
    updates: '.tm-contact-result,.tm-field-error,.tm-form-hint,.tm-target-review', layout: true,
  });
  useEffect(() => { if (submitted) resultRef.current?.focus(); }, [submitted]);
  const details = event && <div className="tm-closed-event"><EventState event={event} t={tr} /><h2>{event.session}</h2><p>{event.date} / {event.time} / {event.venue}</p></div>;

  if (pending) return <PagePending code="GUEST_REQ" t={tr} />;
  if (closed) {
    return <section ref={pageRef} data-readout-region className="tm-form-closed tm-cell"><p className="tm-eyebrow">GUEST_REQ / {event?.id ?? 'EVENTS'}</p>
      <h2 data-view-title data-motion-title tabIndex={-1}><TerminalText>{eventState.kind === 'load-error' ? tr('정보를 불러오지 못했습니다.', 'Could not load information.') : tr('현재 신청 가능한\n이벤트가 없습니다.', 'No events are open\nfor guest requests.')}</TerminalText></h2>
      <div role={eventState.kind === 'load-error' ? 'alert' : 'status'}>{eventState.kind === 'load-error' ? t.request.eventLoadFailed : eventState.kind === 'inactive' ? <><p>{t.request.windowInfo(ACCESS_WINDOW_DAYS)}</p><p>{eventState.window.isElapsed ? t.request.eventElapsed : t.request.windowCountdown(eventState.window.opensInDays ?? 0)}</p></> : t.request.noEvent}</div>
      {details}
      {(eventState.kind === 'load-error' || eventState.kind === 'target-changed') && <button type="button" className="tm-button" onClick={request.retryEvent}>{t.request.retry}</button>}
      <div className="tm-action-group"><Action page="gate" event={event?.id}>{tr('이벤트 정보', 'Event details')}</Action><Action page="signal" secondary>{tr('이벤트 소식 받기', 'Get event updates')}</Action></div>
    </section>;
  }

  return <section ref={pageRef} data-readout-region className="tm-contact-grid" data-kind="request">
    <section className="tm-contact-context tm-cell"><p className="tm-eyebrow">TERMINAL / GUEST_REQ</p><h2 data-view-title data-motion-title tabIndex={-1}><TerminalText>{tr('게스트 신청', 'Guest request')}</TerminalText></h2>
      <div className="tm-contact-context-bottom">{event && <><h2>{event.session}</h2><p className="tm-contact-meta">{event.date} / {event.time}<br />{event.venue}</p></>}
        {!submitted && <div className="tm-contact-notice"><p>{t.request.committedSub}</p><details className="tm-invitation"><summary>{tr('초대문·입장 안내 보기', 'Invitation and entry information')}</summary><div className="tm-prose">{invitationLines.map((line, index) => <p key={index}>{line}</p>)}</div></details></div>}
      </div>
    </section>
    <section data-readout-region ref={inputRef} className="tm-contact-input tm-cell">
      {submitted && event ? <div className="tm-contact-result"><p className="tm-eyebrow">{tr('접수 결과', 'REQUEST RECEIVED')}</p><h2 ref={resultRef} tabIndex={-1}><TerminalText>{tr('신청 접수 완료', 'Request received')}</TerminalText></h2><p>{t.request.committedSub}</p><dl><div><dt>{tr('신청 이벤트', 'Requested event')}</dt><dd>{event.session}</dd></div><div><dt>{tr('이름', 'Name')}</dt><dd>{form.name}</dd></div></dl><p>{form.email}</p><Action page="gate" event={event.id}>{tr('이벤트로 돌아가기', 'Back to event')}</Action></div> : <form className="tm-contact-form" onSubmit={request.handleSubmit} noValidate aria-busy={isSubmitting}>
        <h2 className="tm-eyebrow">{tr('신청 정보', 'REQUEST DETAILS')}</h2>
        {needsTargetReview && <section className="tm-target-review tm-contact-result" aria-labelledby="request-target-title"><h2 id="request-target-title">{tr('신청 대상을 다시 확인해 주세요', 'Review the request event')}</h2><p role="alert">{tr('신청 대상 또는 접수 상태가 바뀌었습니다. 입력한 내용은 유지됩니다. 현재 행사를 확인한 뒤 인증 코드를 다시 확인해 주세요.', 'The request event or its application status has changed. Your draft is preserved. Review the current event, then verify your access code again.')}</p>{nextEvent ? <><h3>{nextEvent.session}</h3><p>{nextEvent.date} / {nextEvent.time} / {nextEvent.venue}</p><button type="button" className="tm-button" onClick={request.acceptNextEvent}>{tr('이 행사로 신청 계속', 'Continue with this event')}</button></> : <p role="status">{isRefreshingEvent ? t.request.loading : t.request.noEvent}</p>}<button type="button" className="tm-button" onClick={request.retryEvent}>{tr('신청 정보 새로고침', 'Refresh request information')}</button></section>}
        <div className="tm-code-block"><FormField id="request-accessCode" label={tr('인증 코드', 'Access code')} error={codeError}><div className="tm-code-row"><input id="request-accessCode" name="accessCode" value={form.accessCode} autoComplete="off" autoCapitalize="characters" required maxLength={128} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'request-accessCode-error request-code-hint' : 'request-code-hint'} onChange={request.handleCodeChange} disabled={isSubmitting || needsTargetReview} /><button type="button" className="tm-button" disabled={isSubmitting || needsTargetReview || !form.accessCode.trim()} onClick={() => request.verifyCode(form.accessCode)}><span>{tr('확인', 'Verify')}</span></button></div></FormField><p id="request-code-hint" className="tm-form-hint" role="status">{codeStatus ?? tr('초대인에게 받은 인증 코드를 입력해 주세요.', 'Enter the access code from your inviter.')}</p></div>
        <fieldset data-motion-controls disabled={!isCodeVerified || isSubmitting} className="tm-contact-fields"><legend className="tm-sr-only">{tr('연락처와 동의', 'Contact and consent')}</legend>
          <FormField id="request-name" label={tr('이름', 'Name')} error={fieldErrors.name}><input id="request-name" name="name" value={form.name} onChange={request.handleTextChange('name')} autoComplete="name" required maxLength={100} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'request-name-error' : undefined} /></FormField>
          <FormField id="request-email" label={tr('이메일', 'Email')} error={fieldErrors.email}><input id="request-email" name="email" type="email" value={form.email} onChange={request.handleTextChange('email')} autoComplete="email" required maxLength={254} placeholder="you@example.com" spellCheck={false} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'request-email-error' : undefined} /></FormField>
          <FormField id="request-instagram" label={tr('인스타그램 ID', 'Instagram ID')} error={fieldErrors.instagram}><input id="request-instagram" name="instagram" value={form.instagram} onChange={request.handleInstagramChange} autoComplete="off" autoCapitalize="none" required maxLength={31} placeholder="@username" spellCheck={false} aria-invalid={Boolean(fieldErrors.instagram)} aria-describedby={fieldErrors.instagram ? 'request-instagram-error' : undefined} /></FormField>
          <div className="tm-consent"><label htmlFor="request-privacyConsent"><input id="request-privacyConsent" name="privacyConsent" type="checkbox" required checked={form.privacyConsent} onChange={e => request.handlePrivacyConsentChange(e.target.checked)} aria-invalid={Boolean(fieldErrors.privacyConsent)} aria-describedby={fieldErrors.privacyConsent ? 'request-privacyConsent-error' : undefined} /><span>{t.request.privacyConsent}</span></label>{fieldErrors.privacyConsent && <p className="tm-field-error" role="alert" id="request-privacyConsent-error">{fieldErrors.privacyConsent}</p>}</div>
          <div className="tm-consent"><label htmlFor="request-marketingConsent"><input id="request-marketingConsent" name="marketingConsent" type="checkbox" checked={form.marketingConsent} onChange={e => request.handleMarketingConsentChange(e.target.checked)} /><span>{t.request.marketingConsent}</span></label></div>
        </fieldset>
        {isCodeVerified && <p className="tm-form-hint">{tr('신청 대상', 'Request for')}: {event?.session} / {event?.date}</p>}
        {formError && <p className="tm-field-error" role="alert">{formError}</p>}
        <button className="tm-action tm-submit" disabled={isSubmitting || !isCodeVerified} aria-busy={isSubmitting} type="submit"><span>{isSubmitting ? tr('처리 중…', 'Processing…') : tr('신청 제출', 'Submit request')}</span>{isSubmitting && <PendingIndicator active />}</button>
        <Link scroll={false} className="tm-text-link" href={request.gateHref}>{tr('이벤트로 돌아가기', 'Back to event')}</Link>
      </form>}
    </section>
  </section>;
}
