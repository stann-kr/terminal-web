'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PublicTransmitLog } from '@/lib/transmit/contract';
import { ApiError, postJson } from '@/features/ui/http';

export type TransmitCallbacks = { onPosted: () => void; onSaved?: () => void };

export function useTransmitPost({ onPosted, onSaved }: TransmitCallbacks) {
  const [draft, setDraft] = useState({ handle: '', message: '' });
  const draftRef = useRef(draft);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null),
    submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null),
    [receipt, setReceipt] = useState<PublicTransmitLog | null>(null);
  function edit(patch: Partial<typeof draft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const submitted = { ...draftRef.current };
    const normalized = {
      handle: submitted.handle.trim().replace(/\s+/g, '_').toUpperCase(),
      message: submitted.message.trim(),
    };
    if (
      !normalized.handle ||
      normalized.handle.length > 24 ||
      !normalized.message ||
      normalized.message.length > 280
    ) {
      setError(
        new ApiError(
          !normalized.handle
            ? 'HANDLE_REQUIRED'
            : normalized.handle.length > 24
              ? 'HANDLE_TOO_LONG'
              : !normalized.message
                ? 'MESSAGE_REQUIRED'
                : 'MESSAGE_TOO_LONG',
          400,
        ),
      );
      return;
    }
    const fingerprint = JSON.stringify(normalized);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = {
        fingerprint,
        key: crypto.randomUUID().replaceAll('-', ''),
      };
    const key = attempt.current.key;
    submitting.current = true;
    setPending(true);
    setError(null);
    setReceipt(null);
    try {
      const result = await postJson<PublicTransmitLog>(
        '/api/transmit',
        normalized,
        { 'Idempotency-Key': key },
      );
      if (
        !result.id ||
        typeof result.handle !== 'string' ||
        typeof result.message !== 'string' ||
        !result.createdAt
      )
        throw new ApiError('INVALID_RESPONSE', 200);
      onSaved?.();
      if (!mounted.current) return;
      setReceipt(result);
      attempt.current = null;
      if (
        draftRef.current.handle === submitted.handle &&
        draftRef.current.message === submitted.message
      )
        edit({ message: '' });
      onPosted();
    } catch (error) {
      if (mounted.current) setError(error);
      if (error instanceof ApiError && error.code === 'IDEMPOTENCY_CONFLICT')
        attempt.current = null;
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { draft, edit, pending, error, receipt, submit };
}
