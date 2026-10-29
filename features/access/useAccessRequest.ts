'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, postJson } from '@/features/ui/http';
import { useAccessDraft, type AccessDraft } from './AccessDraftProvider';
import { inviteCodeFrom } from './invite';

export type AccessAvailability = { canRequest: boolean; message: string };

export function useAccessRequest(
  eventId: string,
  availability: AccessAvailability,
) {
  const { draft, setCode, setFields, clear } = useAccessDraft(eventId);
  const [saved, setSaved] = useState<AccessDraft | null>(null);
  const { code, fields } = saved ?? draft;
  const [verified, setVerified] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [codeMessage, setCodeMessage] = useState('');
  const revision = useRef(0),
    controller = useRef<AbortController | null>(null),
    submitting = useRef(false);
  useEffect(
    () => () => {
      revision.current++;
      controller.current?.abort();
    },
    [],
  );
  const changeCode = (value: string) => {
    revision.current++;
    controller.current?.abort();
    setChecking(false);
    setCode(value);
    setVerified(null);
    setCodeMessage('');
    setError(null);
  };
  async function verifyCode(requested = code) {
    if (!requested.trim() || checking || !availability.canRequest) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const current = ++revision.current;
    const submittedCode = requested.trim();
    setChecking(true);
    setVerified(null);
    setError(null);
    setCodeMessage('');
    try {
      const result = await postJson<{ name: string | null }>(
        '/api/gate/code-info',
        { eventId, code: submittedCode },
        undefined,
        abort.signal,
      );
      if (current !== revision.current) return;
      if (typeof result.name === 'string' && result.name) {
        setVerified({ code: submittedCode, name: result.name });
        setCodeMessage('초대 코드를 확인했습니다.');
      } else setCodeMessage('일치하는 초대 코드가 없습니다.');
    } catch (error) {
      if (
        current === revision.current &&
        !(error instanceof Error && error.name === 'AbortError')
      )
        setError(error);
    } finally {
      if (current === revision.current) setChecking(false);
    }
  }
  // An invite link (`?invite=CODE`) fills in its code and checks it as soon as requests are open,
  // so a friend never types it. Once per visit, and never over a code the guest already typed.
  const invited = useRef(false);
  const latest = useRef({ code, changeCode, verifyCode });
  useEffect(() => {
    latest.current = { code, changeCode, verifyCode };
  });
  useEffect(() => {
    if (invited.current || !availability.canRequest) return;
    invited.current = true;
    const invite = inviteCodeFrom(window.location.search);
    const { code: typed, changeCode: fill, verifyCode: check } = latest.current;
    if (!invite || (typed.trim() && typed.trim() !== invite)) return;
    fill(invite);
    void check(invite);
  }, [availability.canRequest]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      !availability.canRequest ||
      !verified ||
      verified.code !== code.trim()
    )
      return;
    submitting.current = true;
    const submittedDraft = draft;
    setPending(true);
    setError(null);
    try {
      const result = await postJson<{ ok: boolean }>('/api/gate/request', {
        eventId,
        accessCode: verified.code,
        ...fields,
        // A guest who unticked news keeps the typed email in the draft but never sends it.
        email: fields.marketingConsent ? fields.email : undefined,
      });
      if (result.ok !== true) throw new ApiError('INVALID_RESPONSE', 200);
      setSaved(submittedDraft);
      clear(submittedDraft);
    } catch (error) {
      setError(error);
      if (
        error instanceof ApiError &&
        [
          'INVALID_ACCESS_CODE',
          'EVENT_MISMATCH',
          'NO_UPCOMING_EVENT',
          'REQUEST_PERIOD_INACTIVE',
          'ACCESS_NOT_OPEN',
        ].includes(error.code)
      ) {
        setVerified(null);
        setCodeMessage('');
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const errorCode = error instanceof ApiError ? error.code : '';
  const hasDraft = !!(
    code ||
    fields.name ||
    fields.email ||
    fields.instagram ||
    fields.privacyConsent ||
    fields.marketingConsent
  );
  return {
    code,
    verified,
    checking,
    pending,
    done: saved !== null,
    error,
    setError,
    codeMessage,
    fields,
    setFields,
    changeCode,
    verifyCode,
    submit,
    errorCode,
    hasDraft,
  };
}
