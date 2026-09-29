'use client';
import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
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
    <section className={styles.terminalForm}>
      <header className={styles.formHeading}>
        <p className={styles.formCode} aria-hidden="true">
          {code}
        </p>
        <h2>{title}</h2>
      </header>
      <div className={styles.formInterior}>{children}</div>
    </section>
  );
}
export function Field({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
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
      <label htmlFor={props.id}>
        {label}
        {props.required && <span>필수</span>}
      </label>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={`${props.id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${props.id}-error`} className={styles.fieldError}>
          {error}
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
    <section ref={ref} role="status" tabIndex={-1} className={styles.success} data-surface="mint">
      {children}
    </section>
  );
}
export { styles as formStyles };
