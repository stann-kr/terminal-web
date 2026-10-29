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
const MAX_NAME_LENGTH = 100;
const SIGNAL_SUBSCRIPTION_KEYS = ['name', 'email', 'instagram', 'consent'] as const;

export const SIGNAL_SUBSCRIPTION_FIELDS = ['name', 'email', 'instagram', 'consent'] as const;

export type SignalSubscriptionField = typeof SIGNAL_SUBSCRIPTION_FIELDS[number];
export type SignalSubscriptionFieldError =
  | 'ALL_FIELDS_REQUIRED'
  | 'INVALID_INPUT'
  | 'CONSENT_REQUIRED'
  | 'INVALID_EMAIL_FORMAT'
  | 'INVALID_INSTAGRAM_FORMAT';
export type SignalSubscriptionError = SignalSubscriptionFieldError | 'INVALID_INPUT';

export interface SignalSubscriptionInput {
  name: string;
  email: string | null;
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
    || !isString(body.name)
    || (body.email !== undefined && !isString(body.email))
    || !isString(body.instagram)
    || !isBoolean(body.consent)
  ) {
    return { ok: false, error: 'INVALID_INPUT', fieldErrors: {} };
  }

  const name = body.name.trim();
  // News reaches subscribers on Instagram; an email is an optional second channel.
  const email = (body.email ?? '').trim().toLowerCase() || null;
  const instagram = body.instagram.trim();
  const cleanInstagram = instagram.replace(/^@/, '');
  const fieldErrors: SignalSubscriptionFieldErrors = {};

  if (!name) fieldErrors.name = 'ALL_FIELDS_REQUIRED';
  else if (name.length > MAX_NAME_LENGTH) fieldErrors.name = 'INVALID_INPUT';
  if (!instagram) fieldErrors.instagram = 'ALL_FIELDS_REQUIRED';
  else if (
    cleanInstagram.length === 0
    || cleanInstagram.length > MAX_INSTAGRAM_LENGTH
    || !INSTAGRAM_PATTERN.test(cleanInstagram)
  ) {
    fieldErrors.instagram = 'INVALID_INSTAGRAM_FORMAT';
  }
  if (email !== null && (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email))) {
    fieldErrors.email = 'INVALID_EMAIL_FORMAT';
  }

  if (!body.consent) fieldErrors.consent = 'CONSENT_REQUIRED';

  if (Object.keys(fieldErrors).length > 0) {
    const error = !name || !instagram
      ? 'ALL_FIELDS_REQUIRED'
      : !body.consent
        ? 'CONSENT_REQUIRED'
        : fieldErrors.instagram ?? fieldErrors.email ?? 'INVALID_INPUT';
    return { ok: false, error, fieldErrors };
  }

  return {
    ok: true,
    // Same stored spelling as a guest request: lowercase with its @.
    input: { name, email, instagram: `@${cleanInstagram.toLowerCase()}`, consent: true },
    fieldErrors: {},
  };
}
