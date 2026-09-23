'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { useEvents } from '@/features/events/data';
import { accessAvailability, eventHref } from '@/features/events/model';
import { EventFacts } from '@/features/events/EventRecord';
import { Action, Loading, PageHeading, Panel, StateNotice, ui } from '@/features/ui/Ui';
import { Consent, Field, FormError, formStyles } from '@/features/ui/Form';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import styles from './access.module.css';

export function Access({ eventId }: { eventId: string }) {
  const query = useEvents();
  const event = query.events?.find(event => event.id === eventId);
  const availability = event && !query.isError
    ? accessAvailability(event,query.events!,query.now)
    : { canRequest: false, message: query.isPending ? '행사 정보를 확인하고 있습니다.' : query.isError ? '최신 행사 정보를 확인한 뒤 다시 시도해 주세요.' : '신청할 공개 행사 기록을 찾을 수 없습니다.' };
  return <><PageHeading code="ACCESS / GUEST REQUEST" title="게스트 신청"><p>초대 코드를 확인한 뒤 연락처를 입력하세요.<br/>신청 저장은 입장 확정이나 티켓 발급이 아닙니다.</p></PageHeading><div className={styles.layout}><Panel title={event?.session ?? '행사 정보'} code={eventId}>
    {query.isError && <StateNotice error title="행사 정보를 불러오지 못했습니다" retry={() => void query.refetch()}/>}
    {event ? <><EventFacts event={event}/><div className={ui.actions}><Action href={eventHref(event.id)}>행사 상세</Action></div></> : query.isPending ? <Loading/> : !query.isError && <StateNotice error title="신청할 행사를 찾을 수 없습니다"><Action href="/events">행사 목록 확인</Action></StateNotice>}
    </Panel><Panel title="게스트 신청서" code="ACCESS"><AccessForm key={eventId} eventId={eventId} availability={availability}/></Panel></div></>;
}
export function AccessForm({ eventId, availability = { canRequest: true, message: '' } }: { eventId: string; availability?: { canRequest: boolean; message: string } }) {
  const [code,setCode] = useState('');
  const [verified,setVerified] = useState<{ code: string; name: string } | null>(null);
  const [checking,setChecking] = useState(false);
  const [pending,setPending] = useState(false);
  const [done,setDone] = useState(false);
  const [error,setError] = useState<unknown>(null);
  const [codeMessage,setCodeMessage] = useState('');
  const [fields,setFields] = useState({ name: '', email: '', instagram: '', privacyConsent: false, marketingConsent: false });
  const revision = useRef(0), controller = useRef<AbortController | null>(null), submitting = useRef(false);
  useEffect(() => () => { revision.current++; controller.current?.abort(); },[]);
  const changeCode = (value: string) => { revision.current++; controller.current?.abort(); setChecking(false); setCode(value); setVerified(null); setCodeMessage(''); setError(null); };
  async function verifyCode() {
    if (!code.trim() || checking || !availability.canRequest) return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const current = ++revision.current; const submittedCode = code.trim();
    setChecking(true); setVerified(null); setError(null); setCodeMessage('');
    try {
      const result = await postJson<{ name: string | null }>('/api/gate/code-info',{ eventId,code: submittedCode },undefined,abort.signal);
      if (current !== revision.current) return;
      if (typeof result.name === 'string' && result.name) { setVerified({ code: submittedCode, name: result.name }); setCodeMessage('초대 코드를 확인했습니다. 연락처와 동의를 입력해 주세요.'); }
      else setCodeMessage('일치하는 초대 코드가 없습니다. 코드를 다시 확인해 주세요.');
    } catch (error) { if (current === revision.current && !(error instanceof Error && error.name === 'AbortError')) setError(error); }
    finally { if (current === revision.current) setChecking(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !availability.canRequest || !verified || verified.code !== code.trim()) return;
    submitting.current = true; setPending(true); setError(null);
    try {
      const result = await postJson<{ ok: boolean }>('/api/gate/request',{ eventId,accessCode: verified.code,...fields });
      if (result.ok !== true) throw new ApiError('INVALID_RESPONSE',200);
      setDone(true);
    } catch (error) {
      setError(error);
      if (error instanceof ApiError && ['INVALID_ACCESS_CODE','EVENT_MISMATCH','NO_UPCOMING_EVENT','REQUEST_PERIOD_INACTIVE'].includes(error.code)) { setVerified(null); setCodeMessage(''); }
    } finally { submitting.current=false;setPending(false); }
  }
  const errorCode = error instanceof ApiError ? error.code : '';
  const hasDraft = !!(code || fields.name || fields.email || fields.instagram || fields.privacyConsent || fields.marketingConsent);
  const closed = <StateNotice title="현재 신청할 수 없습니다"><p>{availability.message}</p><div className={ui.actions}><Action href="/events">접수 대상 확인</Action><Action href="/signal">소식 신청</Action></div></StateNotice>;
  if (done) return <section role="status" className={formStyles.success}><p className={ui.eyebrow}>REQUEST SAVED</p><h2>게스트 신청을 저장했습니다</h2><p>이 화면은 입장 확정, QR 또는 티켓이 아닙니다. 행사 안내를 확인해 주세요.</p><Action href={eventHref(eventId)}>행사로 돌아가기</Action></section>;
  if (!availability.canRequest && !hasDraft && !pending) return closed;
  return <form onSubmit={submit} className={formStyles.form}>{!availability.canRequest && closed}<FormError message={error ? errorMessage(error) : ''}/><fieldset className={formStyles.fields} disabled={pending || !availability.canRequest}><legend className={styles.legend}>01 / 초대 코드 확인</legend><div className={styles.code}><Field id="access-code" label="초대 코드" required maxLength={64} value={code} autoComplete="off" onChange={event => changeCode(event.target.value)}/><button type="button" className={ui.button} disabled={checking || !code.trim()} onClick={() => void verifyCode()}>{checking ? '확인 중…' : '코드 확인'}</button></div><p className={styles.codeMessage} role="status">{codeMessage}</p>{verified && <p className={styles.inviter}>초대인 <strong>{verified.name}</strong></p>}</fieldset>
    <fieldset className={formStyles.fields} disabled={!verified || pending || !availability.canRequest}><legend className={styles.legend}>02 / 연락처와 동의</legend><Field id="guest-name" label="이름" required maxLength={100} autoComplete="name" value={fields.name} onChange={event => setFields({...fields,name:event.target.value})}/><div className={styles.contacts}><Field id="guest-email" label="이메일" type="email" required maxLength={254} autoComplete="email" value={fields.email} error={errorCode === 'INVALID_EMAIL_FORMAT' ? errorMessage(error) : undefined} onChange={event => setFields({...fields,email:event.target.value})}/><Field id="guest-instagram" label="인스타그램 ID" required maxLength={31} pattern="@?[A-Za-z0-9_.]{1,30}" value={fields.instagram} error={errorCode === 'INVALID_INSTAGRAM_FORMAT' ? errorMessage(error) : undefined} onChange={event => setFields({...fields,instagram:event.target.value})}/></div><div><Consent id="privacy-consent" checked={fields.privacyConsent} required onChange={value => setFields({...fields,privacyConsent:value})}>이름·이메일·인스타그램 ID를 게스트 접근 관리 목적으로 수집합니다. 보존 기간: 이벤트 종료 후 1개월. 제3자 미공개.</Consent><Consent id="marketing-consent" checked={fields.marketingConsent} onChange={value => setFields({...fields,marketingConsent:value})}>[선택] 차기 이벤트 소식를 이메일·인스타그램 채널로 수신합니다. 보존 기간: 수신 거부 시까지.</Consent></div><button className={`${ui.button} ${ui.primary}`} disabled={pending || !verified || !availability.canRequest}>{pending ? '신청 저장 중…' : '게스트 신청 저장'}</button></fieldset><p className={ui.muted}>초대 코드와 연락처는 주소에 포함되지 않습니다.</p></form>;
}
