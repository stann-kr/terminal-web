// @vitest-environment jsdom
import './setup-dom';
import { createElement, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccessRequest } from '../app/gate/request/useAccessRequest';
import { LangProvider, useLang } from '../lib/langContext';
import {
  resolveCodeVerificationState,
  resolveRequestEventState,
} from '../app/gate/request/requestState';
import type { TerminalEvent } from '../lib/events/types';
import RequestAccessPage from '../app/gate/request/page';

const futureEvent: TerminalEvent = {
  id: 'event-1',
  session: 'TERMINAL [01]',
  subtitle: 'Test event',
  date: '2026-09-01',
  time: '23:00 KST',
  venue: 'Test venue',
  district: 'Test district',
  coords: '0, 0',
  capacity: '10',
  sound: 'Test sound',
  status: 'UPCOMING',
  artists: [],
};

describe('request access state', () => {
  const now = new Date('2026-08-15T12:00:00+09:00');

  it('keeps an empty event list distinct from an inactive request window', () => {
    expect(resolveRequestEventState([], 30, now)).toEqual({ kind: 'empty' });
    expect(resolveRequestEventState([futureEvent], 7, now)).toMatchObject({ kind: 'inactive' });
  });

  it('opens the request form only inside the configured request window', () => {
    expect(resolveRequestEventState([futureEvent], 30, now)).toEqual({
      kind: 'ready',
      event: futureEvent,
    });
  });

  it('keeps invalid access codes separate from verification failures', () => {
    expect(resolveCodeVerificationState({ ok: true, status: 200, name: null })).toEqual({
      kind: 'invalid',
    });
    expect(resolveCodeVerificationState({ ok: false, status: 500 })).toEqual({
      kind: 'unavailable',
    });
  });
});


afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('request event binding and draft preservation', () => {
  it('shows the closed event layout instead of a locked form for an archived event', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/gate/request?event=event-1');
    localStorage.setItem('terminal_lang', 'ko');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ ...futureEvent, status: 'ARCHIVED' }])));
    render(createElement(LangProvider, null, createElement(RequestAccessPage)));
    expect(screen.getByRole('heading', { level: 1, name: 'GUEST_REQ' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('현재 신청 가능한 이벤트가 없습니다.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이벤트 정보' })).toHaveAttribute('href', '/gate?event=event-1');
  });

  it('unlocks the real form after code verification and shows a receipt only after the server accepts it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00+09:00'));
    localStorage.setItem('terminal_lang', 'ko');
    window.history.replaceState(null, '', '/gate/request?event=event-1');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'), media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    }));
    let complete!: (response: Response) => void;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url === '/api/events') return Promise.resolve(Response.json([futureEvent]));
      if (url === '/api/gate/code-info') return Promise.resolve(Response.json({ name: 'Inviter' }));
      return new Promise<Response>(resolve => { complete = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(createElement(LangProvider, null, createElement(RequestAccessPage)));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('textbox', { name: '이름' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: '인증 코드' }), { target: { value: 'CODE-1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByRole('textbox', { name: '이름' })).not.toBeDisabled();
    expect(screen.queryByRole('heading', { name: '신청 접수 완료' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: 'Test guest' } });
    fireEvent.change(screen.getByRole('textbox', { name: '이메일' }), { target: { value: 'guest@example.com' } });
    fireEvent.change(screen.getByRole('textbox', { name: '인스타그램 ID' }), { target: { value: 'guest' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /게스트 접근 관리/ }));
    fireEvent.click(screen.getByRole('button', { name: /신청 제출/ }));
    expect(screen.getByRole('button', { name: /처리 중/ })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: '신청 접수 완료' })).not.toBeInTheDocument();
    const submitted = fetchMock.mock.calls.find(([url]) => url === '/api/gate/request');
    expect(JSON.parse(submitted![1]!.body as string)).toMatchObject({ eventId: 'event-1', privacyConsent: true, marketingConsent: false });
    await act(async () => { complete(Response.json({ ok: true })); });
    expect(screen.getByRole('heading', { name: '신청 접수 완료' })).toHaveFocus();
    expect(screen.getByText('접수는 입장 확정을 뜻하지 않습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이벤트로 돌아가기' })).toHaveAttribute('href', '/gate?event=event-1');
  });

  it('keeps an explicit event query distinct from the current eligible event', () => {
    const nextEvent = { ...futureEvent, id: 'next', date: '2026-09-02' };
    expect(resolveRequestEventState([futureEvent, nextEvent], 30, new Date('2026-08-15T12:00:00+09:00'), 'next'))
      .toEqual({ kind: 'target-changed', event: nextEvent, nextEvent: futureEvent });
    expect(resolveCodeVerificationState({ ok: false, status: 409, error: 'EVENT_MISMATCH' }))
      .toEqual({ kind: 'target-changed' });
  });

  it('preserves the draft through language changes and stale-event rejection, then requires explicit event selection', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00+09:00'));
    window.history.replaceState(null, '', '/gate/request?event=event-1');
    const nextEvent = { ...futureEvent, id: 'event-2', session: 'Next event', date: '2026-09-02' };
    let events = [futureEvent];
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/api/events') return Response.json(events);
      if (url === '/api/gate/code-info') return Response.json({ name: 'Inviter' });
      return Response.json({ error: 'EVENT_MISMATCH' }, { status: 409 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => createElement(LangProvider, null, children);
    const { result } = renderHook(() => ({ request: useAccessRequest(), language: useLang() }), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(result.current.request.event?.id).toBe('event-1');

    act(() => result.current.request.handleCodeChange({ target: { value: 'CODE-1' } } as ChangeEvent<HTMLInputElement>));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.request.isCodeVerified).toBe(true);
    act(() => {
      result.current.request.handleTextChange('name')({ target: { value: 'My draft' } } as ChangeEvent<HTMLInputElement>);
      result.current.request.handleTextChange('email')({ target: { value: 'draft@example.com' } } as ChangeEvent<HTMLInputElement>);
      result.current.request.handleInstagramChange({ target: { value: 'draft' } } as ChangeEvent<HTMLInputElement>);
      result.current.request.handlePrivacyConsentChange(true);
      result.current.language.setLang('en');
    });
    expect(result.current.request.form.name).toBe('My draft');
    expect(result.current.request.isCodeVerified).toBe(true);

    events = [nextEvent];
    await act(async () => { await result.current.request.handleSubmit({ preventDefault() {} } as FormEvent); });
    expect(result.current.request.needsTargetReview).toBe(true);
    expect(result.current.request.isCodeVerified).toBe(false);
    expect(result.current.request.form).toMatchObject({ name: 'My draft', email: 'draft@example.com', privacyConsent: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(result.current.request.nextEvent?.id).toBe('event-2');
    expect(result.current.request.gateHref).toBe('/gate?event=event-1');
    expect(window.location.search).toBe('?event=event-1');
    const submitCall = fetchMock.mock.calls.find(([url]) => url === '/api/gate/request');
    expect(JSON.parse((submitCall?.[1] as RequestInit).body as string)).toMatchObject({ eventId: 'event-1', name: 'My draft' });

    act(() => result.current.request.acceptNextEvent());
    expect(window.location.search).toBe('?event=event-2');
    expect(result.current.request.event?.id).toBe('event-2');
    expect(result.current.request.isCodeVerified).toBe(false);
    expect(result.current.request.form.name).toBe('My draft');
    await act(async () => { result.current.request.verifyCode('CODE-1'); });
    expect(result.current.request.isCodeVerified).toBe(true);
    const lastCodeCall = fetchMock.mock.calls.filter(([url]) => url === '/api/gate/code-info').at(-1);
    expect(JSON.parse((lastCodeCall?.[1] as RequestInit).body as string).eventId).toBe('event-2');
  });
});
