"use client";

import { useEffect, useRef } from 'react';
import { useLang } from '@/lib/langContext';
import { useTransmit } from './useTransmit';
import { PageHeading } from '@/features/terminal/shared/Ui';
import { PendingIndicator } from '@/features/terminal/motion/PendingIndicator';
import { useReadoutMotion } from '@/features/terminal/motion/useReadoutMotion';
import { focusNavigationTarget } from '@/features/terminal/shell/useNavigationContinuity';
import '@/features/terminal/forms/forms.css';
import '@/features/terminal/transmit/transmit.css';

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date) + ' KST' : '—';
}

export default function TransmitPage() {
  const { lang } = useLang();
  const tr = (ko: string, en: string) => lang === 'ko' ? ko : en;
  const state = useTransmit();
  const { t, currentPage, handle, message, sent, fieldErrors, formError, logs, total, totalPages,
    isInitialLoad, isFetching, isLogError, isSubmitting } = state;
  const logRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pageChanged = useRef(false);
  const previousPage = useRef(currentPage);
  useEffect(() => {
    if (previousPage.current !== currentPage) pageChanged.current = true;
    previousPage.current = currentPage;
    if (pageChanged.current && !isFetching) {
      focusNavigationTarget(logRef.current?.querySelector('#transmit-log-title') ?? null);
      pageChanged.current = false;
    }
  }, [currentPage, isFetching]);
  useReadoutMotion(logRef, { key: `${lang}:${currentPage}:${isInitialLoad}:${isLogError}:${logs[0]?.id}`, content: ':scope', layout: true });
  useReadoutMotion(formRef, { key: `${formError}:${sent}:${Object.values(fieldErrors).join(',')}`, contentKey: lang, content: ':scope', updates: '.tm-field-error,[role=status]', layout: true });
  const pagination = (position: 'top' | 'bottom') => (totalPages > 1 || currentPage > 1) && <nav className="tm-log-pagination" aria-label={tr(`방명록 페이지 (${position === 'top' ? '위' : '아래'})`, `Guestbook pages (${position})`)}>
    <button type="button" className="tm-button" aria-label={t.transmit.previousPageLabel} disabled={currentPage <= 1 || isFetching || isInitialLoad || isSubmitting} onClick={state.showPreviousPage}><span>{tr('이전', 'Previous')}</span></button>
    <span aria-live={position === 'top' ? 'polite' : undefined}>{isLogError ? currentPage : `${currentPage} / ${Math.max(currentPage, totalPages)}`}</span>
    <button type="button" className="tm-button" aria-label={t.transmit.nextPageLabel} disabled={currentPage >= totalPages || isFetching || isInitialLoad || isLogError || isSubmitting} onClick={state.showNextPage}><span>{tr('다음', 'Next')}</span></button>
  </nav>;
  return <><PageHeading code="TRANSMIT / PUBLIC GUESTBOOK" title={tr('방명록', 'Guestbook')} />
    <div className="tm-transmit-grid"><section className="tm-transmit-compose tm-cell"><h2 data-motion-copy>{tr('글 남기기', 'Leave a message')}</h2><p className="tm-prose" id="transmit-public-notice">{t.transmit.publicNotice}</p>
      <form data-readout-region ref={formRef} onFocusCapture={() => { pageChanged.current = false; }} onSubmit={state.handleSubmit} noValidate aria-busy={isSubmitting} aria-describedby="transmit-public-notice">
        <label htmlFor="transmit-handle">{tr('별칭', 'Alias')}</label><input id="transmit-handle" name="handle" value={handle} maxLength={24} autoComplete="nickname" required aria-invalid={Boolean(fieldErrors.handle)} aria-describedby={fieldErrors.handle ? 'transmit-handle-error' : undefined} onChange={state.handleHandleChange} />
        {fieldErrors.handle && <p className="tm-field-error" role="alert" id="transmit-handle-error">{fieldErrors.handle}</p>}
        <label htmlFor="transmit-message">{tr('메시지', 'Message')}<span id="transmit-message-count">{message.length}/280</span></label><textarea id="transmit-message" name="message" value={message} maxLength={280} rows={6} required aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'transmit-message-error transmit-message-count' : 'transmit-message-count'} onChange={state.handleMessageChange} />
        {fieldErrors.message && <p className="tm-field-error" role="alert" id="transmit-message-error">{fieldErrors.message}</p>}
        {formError && <p className="tm-field-error" role="alert">{formError}</p>}
        <p className="tm-form-hint" role="status">{sent ? t.transmit.committed : ''}</p>
        <button type="submit" className="tm-action" disabled={isSubmitting} aria-busy={isSubmitting}><span>{isSubmitting ? tr('처리 중…', 'Processing…') : tr('메시지 게시', 'Post message')}</span>{isSubmitting && <PendingIndicator active />}</button>
      </form>
    </section>
    <section data-readout-region ref={logRef} className="tm-transmit-log tm-cell" aria-labelledby="transmit-log-title"><div className="tm-log-header"><h2 id="transmit-log-title" tabIndex={-1}>{tr('게시 기록', 'Messages')}</h2>{!isInitialLoad && !isLogError && <span className="tm-eyebrow">{total} {tr('개', 'ENTRIES')}</span>}</div>
      {pagination('top')}
      {isInitialLoad ? <p className="tm-form-hint" role="status">{t.transmit.syncing}</p>
        : isLogError ? <div className="tm-log-empty" role="alert"><p>{t.transmit.logLoadFailed}</p><button type="button" className="tm-button" onClick={state.retryLogs}>{t.transmit.retry}</button></div>
        : logs.length ? <ol aria-busy={isFetching}>{logs.map(entry => <li key={entry.id}><div><h3>{entry.handle}</h3><span><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time></span></div><p>{entry.message}</p></li>)}</ol>
        : <div className="tm-log-empty"><span aria-hidden="true">[00]</span><p role="status">{tr('게시된 글이 없습니다.', 'No messages yet.')}</p></div>}
      {pagination('bottom')}
    </section></div>
  </>;
}
