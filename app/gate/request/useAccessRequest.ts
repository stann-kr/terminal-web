'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useFieldErrors, type FieldErrorMap } from '@/components/ui/useFieldErrors';
import { useLang, useT } from '@/lib/langContext';
import {
  resolveCodeVerificationState,
  resolveRequestEventState,
  type CodeVerificationState,
  type RequestEventState,
} from './requestState';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import { getFutureUpcomingEvent } from '@/lib/events/lifecycle';
import { useEventClock } from '@/lib/events/useEventClock';
import type { TerminalEvent } from '@/lib/events/types';
import { useUrlQueryState } from '@/lib/useUrlQueryState';
import { withMinimumLoading } from '@/features/terminal/shared/minimumLoading';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_PATTERN = /^@?[\w.]+$/;

interface AccessRequestFormState {
  accessCode: string;
  name: string;
  email: string;
  instagram: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
}

type TextField = 'name' | 'email';
export type RequestField = 'accessCode' | TextField | 'instagram' | 'privacyConsent';

const INITIAL_FORM: AccessRequestFormState = {
  accessCode: '',
  name: '',
  email: '',
  instagram: '',
  privacyConsent: false,
  marketingConsent: false,
};

export function useAccessRequest() {
  const { lang } = useLang();
  const t = useT();
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const [eventLoadState, setEventLoadState] = useState<'loading' | 'loaded' | 'load-error'>('loading');
  const [requestedEventId, setRequestedEventId] = useUrlQueryState('event');
  const [initialEventId, setInitialEventId] = useState('');
  const [isTargetReviewRequired, setIsTargetReviewRequired] = useState(false);
  const [verifiedEventId, setVerifiedEventId] = useState('');
  const [submittedEvent, setSubmittedEvent] = useState<TerminalEvent | null>(null);
  const now = useEventClock(events, ACCESS_WINDOW_DAYS);
  const selectedEventId = requestedEventId || initialEventId;
  const eventState: RequestEventState = eventLoadState === 'loaded'
    ? resolveRequestEventState(events, ACCESS_WINDOW_DAYS, now, selectedEventId)
    : { kind: eventLoadState };
  const [eventRequestVersion, setEventRequestVersion] = useState(0);
  const [loadedEventVersion, setLoadedEventVersion] = useState(-1);
  const [form, setForm] = useState<AccessRequestFormState>(INITIAL_FORM);
  const [codeState, setCodeState] = useState<CodeVerificationState>({ kind: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fieldErrors, setFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors<RequestField>('request');
  const [formError, setFormError] = useState('');

  const submittingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verificationAbortRef = useRef<AbortController | null>(null);
  const verificationSequenceRef = useRef(0);

  const event = submittedEvent ?? ('event' in eventState ? eventState.event : null);
  const submitted = submittedEvent !== null;
  const needsTargetReview = isTargetReviewRequired || eventState.kind === 'target-changed';
  const isRefreshingEvent = loadedEventVersion !== eventRequestVersion;
  const nextEvent = needsTargetReview && !isRefreshingEvent ? getFutureUpcomingEvent(events, now) : null;
  const isCodeVerified = codeState.kind === 'verified' && verifiedEventId === event?.id
    && eventState.kind === 'ready' && !needsTargetReview;
  const invitationLines = event?.invitationLines?.[lang] ?? t.request.invitationLines;

  const verifyCode = useCallback((code: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    const normalizedCode = code.trim();
    const sequence = ++verificationSequenceRef.current;

    verificationAbortRef.current?.abort();
    if (!normalizedCode || !event || eventState.kind !== 'ready' || needsTargetReview) {
      setCodeState({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    verificationAbortRef.current = controller;
    setCodeState({ kind: 'verifying' });

    void fetch('/api/gate/code-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalizedCode, eventId: event.id }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as { name?: string | null; error?: string };
        return resolveCodeVerificationState({
          ok: response.ok,
          status: response.status,
          name: data.name,
          error: data.error,
        });
      })
      .then((nextState) => {
        if (sequence !== verificationSequenceRef.current) return;
        setCodeState(nextState);
        if (nextState.kind === 'verified') {
          setVerifiedEventId(event.id);
          clearFieldError('accessCode');
        } else if (nextState.kind === 'target-changed') {
          setIsTargetReviewRequired(true);
          setEventRequestVersion(version => version + 1);
        }
      })
      .catch(() => {
        if (sequence !== verificationSequenceRef.current || controller.signal.aborted) return;
        setCodeState({ kind: 'unavailable' });
      });
  }, [clearFieldError, event, eventState.kind, needsTargetReview]);

  useEffect(() => {
    const controller = new AbortController();
    setEventLoadState(previous => previous === 'loaded' ? previous : 'loading');

    void withMinimumLoading(async () => {
      const response = await fetch('/api/events', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Request event fetch failed');
      const data = await response.json() as unknown;
      if (!Array.isArray(data)) throw new Error('Request event response was not an array');
      return data as TerminalEvent[];
    }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setEvents(data);
        setInitialEventId(previous => previous || getFutureUpcomingEvent(data)?.id || '');
        setEventLoadState('loaded');
        setLoadedEventVersion(eventRequestVersion);
      })
      .catch(() => {
        if (!controller.signal.aborted) setEventLoadState('load-error');
      });

    return () => controller.abort();
  }, [eventRequestVersion]);

  useEffect(() => {
    ++verificationSequenceRef.current;
    verificationAbortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCodeState({ kind: 'idle' });
    setVerifiedEventId('');
  }, [selectedEventId, eventState.kind, needsTargetReview]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    verificationAbortRef.current?.abort();
  }, []);

  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const code = event.target.value;
    setForm(previous => ({ ...previous, accessCode: code }));
    clearFieldError('accessCode');
    ++verificationSequenceRef.current;
    verificationAbortRef.current?.abort();
    setCodeState(code.trim() ? { kind: 'verifying' } : { kind: 'idle' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => verifyCode(code), 500);
  };

  const handleTextChange = (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm(previous => ({ ...previous, [field]: event.target.value }));
    clearFieldError(field);
  };

  const handleInstagramChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/^@+/, '');
    setForm(previous => ({ ...previous, instagram: raw ? `@${raw}` : '' }));
    clearFieldError('instagram');
  };

  const handlePrivacyConsentChange = (checked: boolean) => {
    setForm(previous => ({ ...previous, privacyConsent: checked }));
    clearFieldError('privacyConsent');
  };

  const handleMarketingConsentChange = (checked: boolean) => {
    setForm(previous => ({ ...previous, marketingConsent: checked }));
  };

  const validateForm = (): FieldErrorMap<RequestField> => {
    const errors: FieldErrorMap<RequestField> = {};
    if (!isCodeVerified) {
      errors.accessCode = codeState.kind === 'unavailable'
        ? t.request.codeVerificationUnavailable
        : t.request.errors.INVALID_ACCESS_CODE;
    }
    if (!form.name.trim()) errors.name = t.request.errors.ALL_FIELDS_REQUIRED;
    if (!form.email.trim()) errors.email = t.request.errors.ALL_FIELDS_REQUIRED;
    else if (!EMAIL_PATTERN.test(form.email.trim())) {
      errors.email = t.request.errors.INVALID_EMAIL_FORMAT;
    }
    if (!form.instagram.trim()) errors.instagram = t.request.errors.ALL_FIELDS_REQUIRED;
    else if (!INSTAGRAM_PATTERN.test(form.instagram.trim())) {
      errors.instagram = t.request.errors.INVALID_INSTAGRAM_FORMAT;
    }
    if (!form.privacyConsent) {
      errors.privacyConsent = t.request.errors.PRIVACY_CONSENT_REQUIRED;
    }
    return errors;
  };

  const applyApiError = (errorKey: string) => {
    const message = t.request.errors[errorKey as keyof typeof t.request.errors]
      ?? t.request.errors.TRANSMISSION_FAILED;
    const fieldByError: Partial<Record<string, RequestField>> = {
      INVALID_ACCESS_CODE: 'accessCode',
      INVALID_EMAIL_FORMAT: 'email',
      INVALID_INSTAGRAM_FORMAT: 'instagram',
      PRIVACY_CONSENT_REQUIRED: 'privacyConsent',
    };
    const field = fieldByError[errorKey];
    if (field) {
      showFieldErrors({ [field]: message });
      return;
    }
    setFormError(message);
  };

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (submittingRef.current) return;

    if (eventState.kind !== 'ready' || !event || needsTargetReview) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormError('');
      showFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setFormError('');
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/gate/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, eventId: event.id }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };

      if (!response.ok) {
        if (data.error === 'EVENT_MISMATCH' || data.error === 'EVENT_ID_REQUIRED'
          || data.error === 'NO_UPCOMING_EVENT' || data.error === 'REQUEST_PERIOD_INACTIVE') {
          setIsTargetReviewRequired(true);
          setEventRequestVersion(version => version + 1);
          return;
        }
        applyApiError(data.error ?? '');
        return;
      }
      setSubmittedEvent(event);
    } catch {
      setFormError(t.request.errors.CONNECTION_ERROR);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const codeError = fieldErrors.accessCode
    ?? (codeState.kind === 'invalid' ? t.request.errors.INVALID_ACCESS_CODE : undefined)
    ?? (codeState.kind === 'unavailable' ? t.request.codeVerificationUnavailable : undefined);
  const codeStatus = codeState.kind === 'verifying'
    ? t.request.codeVerifying
    : codeState.kind === 'verified'
      ? t.request.codeVerified(codeState.artistName)
      : undefined;

  return {
    t,
    lang,
    event,
    eventState,
    needsTargetReview,
    isRefreshingEvent,
    nextEvent,
    acceptNextEvent: () => {
      if (!nextEvent) return;
      setRequestedEventId(nextEvent.id);
      setIsTargetReviewRequired(false);
      setCodeState({ kind: 'idle' });
      setVerifiedEventId('');
      setFormError('');
      document.getElementById('request-accessCode')?.focus();
    },
    gateHref: event || selectedEventId ? `/gate?event=${encodeURIComponent(event?.id ?? selectedEventId)}` : '/gate',
    retryEvent: () => setEventRequestVersion(version => version + 1),
    invitationLines,
    form,
    codeState,
    isCodeVerified,
    codeError,
    codeStatus,
    verifyCode,
    handleCodeChange,
    handleTextChange,
    handleInstagramChange,
    handlePrivacyConsentChange,
    handleMarketingConsentChange,
    handleSubmit,
    isSubmitting,
    submitted,
    fieldErrors,
    formError,
  };
}
