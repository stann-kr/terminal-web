import {
  hasOnlyKeys,
  isBoolean,
  isJsonObject,
  isString,
} from '../api/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_PATTERN = /^[\w.]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_INSTAGRAM_LENGTH = 30;
const SIGNAL_SUBSCRIPTION_KEYS = ['email', 'instagram', 'consent'] as const;

export const SIGNAL_SUBSCRIPTION_FIELDS = ['email', 'instagram', 'consent'] as const;

export type SignalSubscriptionField = typeof SIGNAL_SUBSCRIPTION_FIELDS[number];
export type SignalSubscriptionFieldError =
  | 'ALL_FIELDS_REQUIRED'
  | 'CONSENT_REQUIRED'
  | 'INVALID_EMAIL_FORMAT'
  | 'INVALID_INSTAGRAM_FORMAT';
export type SignalSubscriptionError = SignalSubscriptionFieldError | 'INVALID_INPUT';

export interface SignalSubscriptionInput {
  email: string;
  instagram: string;
  consent: true;
}

export type SignalSubscriptionFieldErrors = Partial<
  Record<SignalSubscriptionField, SignalSubscriptionFieldError>
>;

export type SignalSubscriptionValidation =
  | { ok: true; input: SignalSubscriptionInput; fieldErrors: {} }
  | {
      ok: false;
      error: SignalSubscriptionError;
      fieldErrors: SignalSubscriptionFieldErrors;
    };

/** Validates and normalizes the public Signal payload for both UI and API consumers. */
export function validateSignalSubscriptionInput(body: unknown): SignalSubscriptionValidation {
  if (
    !isJsonObject(body)
    || !hasOnlyKeys(body, SIGNAL_SUBSCRIPTION_KEYS)
    || !isString(body.email)
    || !isString(body.instagram)
    || !isBoolean(body.consent)
  ) {
    return { ok: false, error: 'INVALID_INPUT', fieldErrors: {} };
  }

  const email = body.email.trim().toLowerCase();
  const instagram = body.instagram.trim();
  const cleanInstagram = instagram.replace(/^@/, '');
  const fieldErrors: SignalSubscriptionFieldErrors = {};

  if (!email) fieldErrors.email = 'ALL_FIELDS_REQUIRED';
  else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'INVALID_EMAIL_FORMAT';
  }

  // The channel mails by address; an Instagram handle is optional and stored empty when left out.
  if (
    instagram
    && (
      cleanInstagram.length === 0
      || cleanInstagram.length > MAX_INSTAGRAM_LENGTH
      || !INSTAGRAM_PATTERN.test(cleanInstagram)
    )
  ) {
    fieldErrors.instagram = 'INVALID_INSTAGRAM_FORMAT';
  }

  if (!body.consent) fieldErrors.consent = 'CONSENT_REQUIRED';

  if (Object.keys(fieldErrors).length > 0) {
    const error = !email
      ? 'ALL_FIELDS_REQUIRED'
      : !body.consent
        ? 'CONSENT_REQUIRED'
        : fieldErrors.email ?? fieldErrors.instagram ?? 'INVALID_INPUT';
    return { ok: false, error, fieldErrors };
  }

  return {
    ok: true,
    input: { email, instagram, consent: true },
    fieldErrors: {},
  };
}
