'use client';
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './form.module.css';
export function FormPanel({ title, code, children }: { title: string; code: string; children: ReactNode }) {
  return <section data-readout-panel="" className={styles.terminalForm}><div className={styles.formInterior}><header className={styles.formHeading}><div className={styles.seal} aria-hidden="true"/><p className={styles.formCode} aria-hidden="true">{code}</p><h2 data-readout-row="">{title}</h2></header>{children}</div></section>;
}
export function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return <div className={styles.field}><label htmlFor={props.id}>{label}{props.required && <span>필수</span>}</label><input {...props} aria-invalid={error ? true : undefined} aria-describedby={error ? `${props.id}-error` : props['aria-describedby']}/>{error && <p id={`${props.id}-error`} className={styles.fieldError}>{error}</p>}</div>;
}
export function Consent({ id, checked, onChange, required = false, children }: { id: string; checked: boolean; onChange: (value: boolean) => void; required?: boolean; children: ReactNode }) {
  return <label className={styles.consent} htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} required={required}/><span>{required ? '[필수] ' : ''}{children}</span></label>;
}
export function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) ref.current?.focus(); },[message]);
  return message ? <div ref={ref} className={styles.error} role="alert" tabIndex={-1}>{message}</div> : null;
}
export { styles as formStyles };
