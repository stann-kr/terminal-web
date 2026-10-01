'use client';
import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { Bay } from './Ui';
import styles from './form.module.css';
export function FormPanel({
  title,
  code,
  children,
}: {
  title: string;
  code: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.terminalForm} data-surface="paper">
      <header className={styles.formHeading}>
        <p className={styles.formCode} aria-hidden="true">
          {code}
        </p>
        <h2>{title}</h2>
      </header>
      <div className={styles.formInterior}>
        {children}
        <Bay label={`${code} / FORM`} />
      </div>
    </section>
  );
}
/** For handles and codes, typed as they are: no capital first letter, no autocorrect. */
export const literalInput = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

export function Field({
  label,
  error,
  hint,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy =
    [
      props['aria-describedby'],
      hint && `${props.id}-hint`,
      error && `${props.id}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      {/* A field error is printed in the label bar, where "필수" sits: the form keeps its height. */}
      <div className={styles.fieldHead}>
        <label htmlFor={props.id}>
          {label}
          {props.required && !error && <span>필수</span>}
        </label>
        {error && (
          <p id={`${props.id}-error`} className={styles.fieldError}>
            {error}
          </p>
        )}
      </div>
      <input
        {...props}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={`${props.id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
export function Consent({
  id,
  checked,
  onChange,
  required = false,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={styles.consent} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required={required}
      />
      <span>
        {required ? '[필수] ' : ''}
        {children}
      </span>
    </label>
  );
}
export function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return message ? (
    <div ref={ref} className={styles.error} role="alert" tabIndex={-1}>
      {message}
    </div>
  ) : null;
}
export function FormSuccess({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section ref={ref} role="status" tabIndex={-1} className={styles.success} data-surface="fresh">
      {children}
    </section>
  );
}
export { styles as formStyles };
