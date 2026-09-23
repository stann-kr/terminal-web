'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import type { PublicTransmitLog } from '@/lib/transmit/contract';
import { PageHeading, Pagination, Panel, ui } from '@/features/ui/Ui';
import { Field, FormError, formStyles } from '@/features/ui/Form';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import { pageNumber } from '@/features/events/model';
import { Feed, useTransmit } from './Feed';
import styles from './transmit.module.css';
export function Transmit() {
  const params=useSearchParams(),router=useRouter(),client=useQueryClient();
  const page=pageNumber(params.get('page')), query=useTransmit(page);
  return <><PageHeading code="05 / TRANSMIT" title="방문자 로그"><p>남기고 싶은 말, 지난 밤의 기억.<br/>모두에게 공개되는 기록입니다.</p></PageHeading><div className={styles.layout}><Panel title="기록 남기기" code="WRITE"><TransmitForm onPosted={() => { void client.invalidateQueries({ queryKey:['transmit'] }); if(page !== 1) router.replace('/transmit',{scroll:false}); }}/></Panel><Panel title="공개 로그" code={query.data ? `${query.data.total} RECORDS` : 'READ'}><Feed page={page}/>{query.data && <Pagination page={page} totalPages={query.data.totalPages} href={page => `/transmit?page=${page}`}/>}</Panel></div></>;
}
export function TransmitForm({ onPosted }: { onPosted: () => void }) {
  const [draft,setDraft] = useState({handle:'',message:''});
  const draftRef=useRef(draft);
  const attempt=useRef<{ fingerprint:string;key:string } | null>(null), submitting=useRef(false);
  const [pending,setPending]=useState(false),[error,setError]=useState<unknown>(null),[receipt,setReceipt]=useState<PublicTransmitLog|null>(null);
  function edit(patch: Partial<typeof draft>) { const next={...draftRef.current,...patch};draftRef.current=next;setDraft(next); }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(submitting.current) return;
    const submitted={...draftRef.current};
    const normalized={handle:submitted.handle.trim().replace(/\s+/g,'_').toUpperCase(),message:submitted.message.trim()};
    if(!normalized.handle || normalized.handle.length>24 || !normalized.message || normalized.message.length>280) { setError(new ApiError(!normalized.handle?'HANDLE_REQUIRED':normalized.handle.length>24?'HANDLE_TOO_LONG':!normalized.message?'MESSAGE_REQUIRED':'MESSAGE_TOO_LONG',400));return; }
    const fingerprint=JSON.stringify(normalized);
    if(attempt.current?.fingerprint!==fingerprint) attempt.current={fingerprint,key:crypto.randomUUID().replaceAll('-','')};
    const key=attempt.current.key;
    submitting.current=true;setPending(true);setError(null);setReceipt(null);
    try {
      const result=await postJson<PublicTransmitLog>('/api/transmit',normalized,{'Idempotency-Key':key});
      if(!result.id || typeof result.handle!=='string' || typeof result.message!=='string' || !result.createdAt) throw new ApiError('INVALID_RESPONSE',200);
      setReceipt(result);attempt.current=null;
      if(draftRef.current.handle===submitted.handle && draftRef.current.message===submitted.message) edit({message:''});
      onPosted();
    } catch(error) { setError(error); if(error instanceof ApiError && error.code==='IDEMPOTENCY_CONFLICT') attempt.current=null; }
    finally { submitting.current=false;setPending(false); }
  }
  return <form className={formStyles.form} onSubmit={submit}><div className={styles.counter}><span>MESSAGE LENGTH</span><strong>{draft.message.length}<small>/280</small></strong></div><FormError message={error?errorMessage(error):''}/>{receipt && <div role="status" className={styles.receipt}>기록을 저장했습니다. {receipt.handle} · {receipt.ts} KST</div>}<Field id="transmit-handle" label="공개 닉네임" required maxLength={96} autoComplete="nickname" value={draft.handle} onChange={event=>edit({handle:event.target.value})}/><div className={formStyles.field}><label htmlFor="transmit-message">메시지 <span>필수</span></label><textarea id="transmit-message" required maxLength={280} rows={5} value={draft.message} onChange={event=>edit({message:event.target.value})} aria-describedby="transmit-public"/></div><p id="transmit-public" className={ui.muted}>닉네임과 메시지는 공개됩니다. 연락처나 초대 코드는 남기지 마세요. 닉네임의 공백은 밑줄, 영문은 대문자로 저장됩니다.</p><button disabled={pending} className={`${ui.button} ${ui.primary}`}>{pending?'전송 중…':'기록 전송'}</button></form>;
}
