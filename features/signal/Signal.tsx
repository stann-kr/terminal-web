'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Action, PageHeading, Panel, ui } from '@/features/ui/Ui';
import { Consent, Field, FormError, formStyles } from '@/features/ui/Form';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import styles from './signal.module.css';
export function Signal() {
  const [fields,setFields] = useState({ email:'',instagram:'',consent:false });
  const [pending,setPending] = useState(false), [done,setDone] = useState(false), [error,setError] = useState<unknown>(null);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(submitting.current) return;
    submitting.current=true;setPending(true);setError(null);
    try { const result=await postJson<{ok:boolean}>('/api/signal',fields); if(result.ok !== true) throw new ApiError('INVALID_RESPONSE',200);setDone(true); }
    catch(error) { setError(error); }
    finally { submitting.current=false;setPending(false); }
  }
  const errorCode=error instanceof ApiError ? error.code : '';
  return <><PageHeading code="SIGNAL / EVENT UPDATES" title="다음 만남의 소식"><p>새로운 행사 소식을 받을 연락처를 남겨 주세요.</p></PageHeading><div className={styles.layout}><Panel title="수신 안내" code="SIGNAL"><p>TERMINAL의 새로운 행사와 소식을 안내합니다.</p><p className={styles.note}>이 신청은 연락처 저장입니다. 인증 이메일 발송이나 이메일 소유권 확인을 뜻하지 않습니다.</p><Action href="/about">소개 / 공식 채널</Action></Panel><Panel title="소식 신청서">{done ? <section role="status" className={formStyles.success}><p className={ui.eyebrow}>CONTACT SAVED</p><h2>소식 신청을 저장했습니다</h2><p>남겨주신 연락처로 TERMINAL의 다음 소식을 전하겠습니다.</p><Action href="/">홈으로 돌아가기</Action></section> : <form onSubmit={submit} className={formStyles.form}><FormError message={error ? errorMessage(error) : ''}/><fieldset disabled={pending} className={formStyles.fields}><Field id="signal-email" label="이메일" required type="email" maxLength={254} autoComplete="email" value={fields.email} error={errorCode === 'INVALID_EMAIL_FORMAT' ? errorMessage(error) : undefined} onChange={event => setFields({...fields,email:event.target.value})}/><Field id="signal-instagram" label="인스타그램 ID" required maxLength={31} pattern="@?[A-Za-z0-9_.]{1,30}" value={fields.instagram} error={errorCode === 'INVALID_INSTAGRAM_FORMAT' ? errorMessage(error) : undefined} onChange={event => setFields({...fields,instagram:event.target.value})}/><Consent required id="signal-consent" checked={fields.consent} onChange={value => setFields({...fields,consent:value})}>이메일·인스타그램 계정을 TERMINAL 이벤트 소식 안내 목적으로 수집하는 데 동의합니다.</Consent><button className={`${ui.button} ${ui.primary}`}>{pending ? '저장 중…' : '소식 신청 저장'}</button></fieldset></form>}</Panel></div></>;
}
