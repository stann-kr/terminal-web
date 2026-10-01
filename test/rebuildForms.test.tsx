import { afterEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TerminalEvent } from '../lib/events/types';
import { AccessForm, AccessRequest } from '../features/access/Access';
import { TransmitForm } from '../features/transmit/TransmitForm';
import { SignalBody } from '../features/signal/Signal';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const log={id:'log-1',handle:'VISITOR',message:'hello',ts:'2026.09.24 / 04:00',createdAt:'2026-09-23T19:00:00.000Z'};
describe('guest request UI',()=>{
  it.each([true,false])('preserves a pending request through event closure and handles its result (saved=%s)',async(saved)=>{
    const event:TerminalEvent={id:'A',session:'Test event',subtitle:'',date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),time:'23:00',venue:'Local',district:'',coords:'',capacity:'',sound:'',status:'UPCOMING',artists:[]};
    const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});client.setQueryData(['events'],[event]);
    let resolve!:(value:Response)=>void;
    const fetch=vi.fn().mockResolvedValueOnce(json({name:'INVITER'})).mockReturnValueOnce(new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();const mounted=render(<QueryClientProvider client={client}><AccessRequest eventId="A"/></QueryClientProvider>);
    await user.type(screen.getByLabelText(/초대 코드/),'CODE');await user.click(screen.getByRole('button',{name:'코드 확인'}));
    await user.type(screen.getByLabelText(/^이름/),'Example');await user.type(screen.getByLabelText(/^이메일/),'example@example.test');await user.type(screen.getByRole('textbox',{name:/인스타그램 ID/}),'example');await user.click(screen.getByRole('checkbox',{name:/게스트 접근 관리/}));await user.click(screen.getByRole('button',{name:'게스트 신청 저장'}));
    await act(async()=>{client.setQueryData(['events'],[{...event,status:'ARCHIVED'}]);});
    expect(screen.getByLabelText(/^이름/)).toHaveValue('Example');expect(screen.getByRole('button',{name:'신청 저장 중…'})).toBeDisabled();
    await act(async()=>{resolve(saved?json({ok:true}):json({error:'DATA_UNAVAILABLE'},503));});
    if(saved) { expect(await screen.findByRole('heading',{name:'게스트 신청을 저장했습니다'})).toBeInTheDocument();await act(async()=>{client.setQueryData(['events'],[]);});expect(screen.getByRole('heading',{name:'게스트 신청을 저장했습니다'})).toBeInTheDocument(); }
    else { expect(await screen.findByRole('alert')).toHaveTextContent('이벤트 정보를 확인할 수 없습니다');expect(screen.getByLabelText(/^이름/)).toHaveValue('Example');expect(screen.getByRole('button',{name:'게스트 신청 저장'})).toBeDisabled(); }
    mounted.unmount();client.clear();
  });
  it('discards a late code lookup after the input changes and requires a fresh verification',async()=>{
    let resolve!:(value:Response)=>void;
    const fetch=vi.fn().mockReturnValue(new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();render(<AccessForm eventId="A"/>);
    await user.type(screen.getByLabelText(/초대 코드/),'FIRST');await user.click(screen.getByRole('button',{name:'코드 확인'}));
    await user.clear(screen.getByLabelText(/초대 코드/));await user.type(screen.getByLabelText(/초대 코드/),'SECOND');
    await act(async()=>{resolve(json({name:'STALE INVITER'}));});
    expect(screen.queryByText('STALE INVITER')).not.toBeInTheDocument();expect(screen.getByLabelText(/^이름/)).toBeDisabled();
    expect(screen.getByRole('button',{name:'게스트 신청 저장'})).toBeDisabled();
  });
  it('keeps event identity and consent in the payload, invalidates mismatch without resubmitting',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(json({name:'INVITER'})).mockResolvedValueOnce(json({error:'EVENT_MISMATCH'},409));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();render(<AccessForm eventId="A"/>);
    await user.type(screen.getByLabelText(/초대 코드/),'CODE');await user.click(screen.getByRole('button',{name:'코드 확인'}));
    await user.type(screen.getByLabelText(/^이름/),'Example');await user.type(screen.getByLabelText(/^이메일/),'example@example.test');await user.type(screen.getByRole('textbox',{name:/인스타그램 ID/}),'example');
    await user.click(screen.getByRole('checkbox',{name:/게스트 접근 관리/}));await user.click(screen.getByRole('button',{name:'게스트 신청 저장'}));
    await screen.findByRole('alert');expect(fetch).toHaveBeenCalledTimes(2);
    const payload=JSON.parse(fetch.mock.calls[1][1].body);
    expect(payload).toEqual({eventId:'A',accessCode:'CODE',name:'Example',email:'example@example.test',instagram:'example',privacyConsent:true,marketingConsent:false});
    expect(screen.getByLabelText(/^이름/)).toHaveValue('Example');expect(screen.getByLabelText(/^이름/)).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('접수');expect(screen.queryByText('초대 코드를 확인했습니다.')).not.toBeInTheDocument();
  });
  it('reports a stored request without claiming admission or tickets',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(json({name:'INVITER'})).mockResolvedValueOnce(json({ok:true})));
    const user=userEvent.setup();render(<AccessForm eventId="A"/>);
    await user.type(screen.getByLabelText(/초대 코드/),'CODE');await user.click(screen.getByRole('button',{name:'코드 확인'}));
    await user.type(screen.getByLabelText(/^이름/),'Example');await user.type(screen.getByLabelText(/^이메일/),'example@example.test');await user.type(screen.getByRole('textbox',{name:/인스타그램 ID/}),'example');await user.click(screen.getByRole('checkbox',{name:/게스트 접근 관리/}));await user.click(screen.getByRole('button',{name:'게스트 신청 저장'}));
    expect(await screen.findByRole('heading',{name:'게스트 신청을 저장했습니다'})).toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('게스트 신청을 저장했습니다');expect(screen.getByRole('status')).toHaveFocus();
  });
  it('checks the code on Enter, then moves on to the name and summarises the saved request',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(json({name:'INVITER'})).mockResolvedValueOnce(json({ok:true}));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();render(<AccessForm eventId="A"/>);
    expect(screen.getByText('초대 코드를 확인하면 입력할 수 있습니다.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/초대 코드/),'CODE{Enter}');
    expect(await screen.findByText('초대 코드를 확인했습니다.')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/gate/code-info');
    expect(screen.getByLabelText(/^이름/)).toHaveFocus();
    expect(screen.queryByText('초대 코드를 확인하면 입력할 수 있습니다.')).not.toBeInTheDocument();
    await user.keyboard('Example');await user.type(screen.getByLabelText(/^이메일/),'example@example.test');await user.type(screen.getByRole('textbox',{name:/인스타그램 ID/}),'@example');await user.click(screen.getByRole('checkbox',{name:/게스트 접근 관리/}));await user.click(screen.getByRole('button',{name:'게스트 신청 저장'}));
    const saved=await screen.findByRole('status');
    expect(saved).toHaveTextContent('INVITER');expect(saved).toHaveTextContent('example@example.test');expect(saved).toHaveTextContent('@example');
    expect(screen.getByRole('link',{name:'다음 이벤트 소식 신청'})).toHaveAttribute('href','/signal');
  });
});
describe('transmit UI',()=>{
  it('refreshes saved data but never navigates from a form that was left during submission',async()=>{
    let resolve!:(value:Response)=>void;
    vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise<Response>(done=>{resolve=done;})));
    const onPosted=vi.fn(),onSaved=vi.fn(),user=userEvent.setup();
    const view=render(<TransmitForm onPosted={onPosted} onSaved={onSaved}/>);
    await user.type(screen.getByLabelText(/공개 닉네임/),'visitor');await user.type(screen.getByLabelText(/메시지/),'hello');await user.click(screen.getByRole('button',{name:'기록 전송'}));
    view.unmount();await act(async()=>{resolve(json(log,201));});
    expect(onSaved).toHaveBeenCalledOnce();expect(onPosted).not.toHaveBeenCalled();
  });
  it('retries the same uncertain write with the same key, then changes the key for changed content',async()=>{
    const fetch=vi.fn().mockRejectedValue(new TypeError('offline'));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();render(<TransmitForm onPosted={vi.fn()}/>);
    await user.type(screen.getByLabelText(/공개 닉네임/),'visitor');await user.type(screen.getByLabelText(/메시지/),'hello');await user.click(screen.getByRole('button',{name:'기록 전송'}));await screen.findByRole('alert');
    await user.click(screen.getByRole('button',{name:'기록 전송'}));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1][1].headers['Idempotency-Key']);
    await user.type(screen.getByLabelText(/메시지/),' again');await user.click(screen.getByRole('button',{name:'기록 전송'}));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
    expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).not.toBe(fetch.mock.calls[1][1].headers['Idempotency-Key']);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({handle:'VISITOR',message:'hello'});
  });
  it('preserves text edited while a write is pending and refreshes only after a stored log response',async()=>{
    let resolve!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise<Response>(r=>{resolve=r;})));
    const onPosted=vi.fn(),user=userEvent.setup();render(<TransmitForm onPosted={onPosted}/>);
    await user.type(screen.getByLabelText(/공개 닉네임/),'visitor');await user.type(screen.getByLabelText(/메시지/),'hello');await user.click(screen.getByRole('button',{name:'기록 전송'}));
    expect(onPosted).not.toHaveBeenCalled();await user.clear(screen.getByLabelText(/메시지/));await user.type(screen.getByLabelText(/메시지/),'my next draft');
    await act(async()=>{resolve(json(log,201));});expect(onPosted).toHaveBeenCalledOnce();expect(screen.getByLabelText(/메시지/)).toHaveValue('my next draft');expect(screen.getByRole('status')).toHaveTextContent('기록을 저장했습니다');
  });
  it('posts under the visitor node name kept in this browser when no nickname is given',async()=>{
    localStorage.removeItem('terminal_node_id');
    const fetch=vi.fn().mockResolvedValue(json(log,201));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();const first=render(<TransmitForm onPosted={vi.fn()}/>);
    await user.type(screen.getByLabelText(/메시지/),'hello');await user.click(screen.getByRole('button',{name:'기록 전송'}));await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
    const {handle}=JSON.parse(fetch.mock.calls[0][1].body);expect(handle).toMatch(/^NODE-[A-HJ-NP-Z2-9]{5}$/);
    first.unmount();render(<TransmitForm onPosted={vi.fn()}/>);
    expect(screen.getByLabelText(/공개 닉네임/)).toHaveAttribute('placeholder',handle);
  });
  it('does not accept a malformed successful HTTP response as a saved log',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({ok:true})));const onPosted=vi.fn(),user=userEvent.setup();render(<TransmitForm onPosted={onPosted}/>);
    await user.type(screen.getByLabelText(/공개 닉네임/),'visitor');await user.type(screen.getByLabelText(/메시지/),'hello');await user.click(screen.getByRole('button',{name:'기록 전송'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('서버 응답');expect(onPosted).not.toHaveBeenCalled();expect(screen.getByLabelText(/메시지/)).toHaveValue('hello');
  });
});
describe('signal UI',()=>{
  it.each([true,false])('requires consent and syncs the matrix with the actual request result (saved=%s)',async saved=>{
    let resolve!:(value:Response)=>void;
    const fetch=vi.fn().mockReturnValue(new Promise<Response>(done=>{resolve=done;}));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();const {container}=render(<SignalBody/>);
    const matrix=container.querySelector('[aria-hidden=true][data-state]')!;
    expect(matrix).toHaveAttribute('data-state','idle');
    await user.type(screen.getByLabelText(/^이메일/),'reader@example.test');await user.type(screen.getByRole('textbox',{name:/인스타그램 ID/}),'reader');await user.click(screen.getByRole('button',{name:'소식 신청 저장'}));expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'소식 신청 저장'}));
    expect(matrix).toHaveAttribute('data-state','sending');
    expect(screen.getByRole('button',{name:'저장 중…'})).toBeDisabled();
    await act(async()=>{resolve(saved?json({ok:true}):json({error:'UNAVAILABLE'},503));});
    if(saved) {
      expect(await screen.findByRole('heading',{name:'소식 신청을 저장했습니다'})).toBeInTheDocument();
      expect(matrix).toHaveAttribute('data-state','saved');
      expect(screen.getByRole('status')).toHaveFocus();
    } else {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(matrix).toHaveAttribute('data-state','error');
      expect(screen.getByLabelText(/^이메일/)).toHaveValue('reader@example.test');
    }
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:'reader@example.test',instagram:'reader',consent:true});
  });
});

describe('field error recovery',()=>{
  it.each(['access','signal'] as const)('clears only the edited field validation error in %s',async form=>{
    const fetch=vi.fn();
    if(form==='access') fetch.mockResolvedValueOnce(json({name:'INVITER'}));
    fetch.mockResolvedValue(json({error:'INVALID_EMAIL_FORMAT'},400));vi.stubGlobal('fetch',fetch);
    const user=userEvent.setup();render(form==='access'?<AccessForm eventId="A"/>:<SignalBody/>);
    if(form==='access') {
      await user.type(screen.getByLabelText(/초대 코드/),'CODE');await user.click(screen.getByRole('button',{name:'코드 확인'}));
      await user.type(screen.getByLabelText(/^이름/),'Example');
    }
    const email=screen.getByLabelText(/^이메일/),instagram=screen.getByRole('textbox',{name:/인스타그램 ID/});
    await user.type(email,'old@example.test');await user.type(instagram,'example');
    await user.click(screen.getAllByRole('checkbox')[0]);await user.click(screen.getByRole('button',{name:form==='access'?'게스트 신청 저장':'소식 신청 저장'}));
    await screen.findByRole('alert');expect(email).toHaveAttribute('aria-invalid','true');
    await user.type(instagram,'_changed');expect(email).toHaveAttribute('aria-invalid','true');
    await user.clear(email);await user.type(email,'correct@example.test');
    expect(email).not.toHaveAttribute('aria-invalid');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
