'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError, postJson } from '@/features/ui/http';

export function useSignalSubscription() {
  const [fields, setFields] = useState({
    name: '',
    instagram: '',
    consent: false,
    wantsEmail: false,
    email: '',
  });
  const [pending, setPending] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const { wantsEmail, email, ...required } = fields;
      // An email typed and then un-ticked stays in the form but is never sent.
      const result = await postJson<{ ok: boolean }>('/api/signal', {
        ...required,
        email: wantsEmail ? email : undefined,
      });
      if (result.ok !== true) throw new ApiError('INVALID_RESPONSE', 200);
      setDone(true);
    } catch (error) {
      setError(error);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const errorCode = error instanceof ApiError ? error.code : '';
  return {
    fields,
    setFields,
    pending,
    done,
    error,
    setError,
    submit,
    errorCode,
  };
}
