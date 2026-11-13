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
  const [waitlisted, setWaitlisted] = useState(false);
  const { code, fields } = saved ?? draft;
  const [verified, setVerified] = useState<{
    code: string;
    name: string;
    /** False once the inviter's guest limit is reached: the form then puts the guest on its waitlist. */
    open: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [codeMessage, setCodeMessage] = useState('');
  // Counts the saves a code that filled up meanwhile turned into the waitlist form (see submit).
  const [turned, setTurned] = useState(0);
  // The terms the consent box last stood under in this visit: null until a code is checked.
  const waitlistTerms = useRef<boolean | null>(null);
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
      const result = await postJson<{ name: string | null; open?: boolean }>(
        '/api/gate/code-info',
        { eventId, code: submittedCode },
        undefined,
        abort.signal,
      );
      if (current !== revision.current) return;
      if (typeof result.name === 'string' && result.name) {
        const open = result.open !== false;
        // Consent answers the terms on screen. Another code can bring the other terms (the
        // waitlist shares the Instagram id with the artist), so a tick made before is not kept.
        if (fields.privacyConsent && (waitlistTerms.current ?? false) !== !open)
          setFields({ ...fields, privacyConsent: false });
        waitlistTerms.current = !open;
        setVerified({ code: submittedCode, name: result.name, open });
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
    // A full code takes no email: waiting guests hear from the artist, not from TERMINAL's news.
    const waiting = !verified.open;
    const marketingConsent = waiting ? false : fields.marketingConsent;
    setPending(true);
    setError(null);
    try {
      const result = await postJson<{ ok: boolean; waitlisted?: boolean }>('/api/gate/request', {
        eventId,
        accessCode: verified.code,
        ...fields,
        marketingConsent,
        // A guest who unticked news keeps the typed email in the draft but never sends it.
        email: marketingConsent ? fields.email : undefined,
        // Only the waitlist form says the guest may wait; the server keeps no one waiting without it.
        ...(waiting ? { waitlist: true } : {}),
      });
      if (result.ok !== true) throw new ApiError('INVALID_RESPONSE', 200);
      setWaitlisted(result.waitlisted === true);
      // The summary shows what was sent, not what a hidden box still held.
      setSaved({
        ...submittedDraft,
        fields: { ...submittedDraft.fields, marketingConsent, email: marketingConsent ? submittedDraft.fields.email : '' },
      });
      clear(submittedDraft);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'GUEST_LIMIT_REACHED' && !waiting) {
        // The code filled up while the guest was writing. Waiting shares more with the artist than
        // they agreed to, so the form turns to the waitlist terms and asks, instead of failing.
        waitlistTerms.current = true;
        setVerified({ ...verified, open: false });
        setFields({ ...fields, privacyConsent: false });
        setCodeMessage('신청하는 사이 초대가 마감되었습니다. 대기 신청 내용을 확인해 주십시오.');
        setTurned((count) => count + 1);
        return;
      }
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
  // A full code, at the check or at a save that came too late, puts the form in waitlist mode; a
  // code that cannot take even a waiting guest (GUEST_LIMIT_REACHED again) closes the invite.
  const waitlist = verified !== null && !verified.open;
  const closedInviter = verified && waitlist && errorCode === 'GUEST_LIMIT_REACHED' ? verified.name : null;
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
    waitlist,
    waitlisted,
    turned,
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
    closedInviter,
  };
}
