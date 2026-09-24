import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './ui.module.css';

export function PageHeading({ title }: { title: string }) {
  return <h1 className={styles.srOnly}>{title}</h1>;
}
export function Panel({ title, code, children, className = '' }: { title: string; code?: string; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><h2 className={styles.sectionTitle}>{title}{code && <span>{code}</span>}</h2>{children}</section>;
}
export function Action({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`${styles.action} ${primary ? styles.primary : ''}`} href={href}>{children}</Link>;
}
export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return <dl className={styles.facts}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === '' || value == null ? '미정' : value}</dd></div>)}</dl>;
}
export function StateNotice({ title, children, error = false, retry }: { title: string; children?: ReactNode; error?: boolean; retry?: () => void }) {
  return <div className={`${styles.notice} ${error ? styles.error : ''}`} role={error ? 'alert' : 'status'}><p className={styles.eyebrow}>{error ? 'READ ERROR' : 'INFORMATION'}</p><h2>{title}</h2>{children && <div>{children}</div>}{retry && <button type="button" className={styles.button} onClick={retry}>다시 불러오기</button>}</div>;
}
export function Loading() { return <p role="status" className={styles.loading}>기록을 불러오는 중<span aria-hidden="true"> ▪</span></p>; }
export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages < 2 && page === 1) return null;
  return <nav aria-label="페이지 이동" className={styles.pagination}>{page > 1 ? <Link href={href(page - 1)}>← 이전</Link> : <span>이전</span>}<span aria-live="polite">{page} / {Math.max(totalPages,1)}</span>{page < totalPages ? <Link href={href(page + 1)}>다음 →</Link> : <span>다음</span>}</nav>;
}
export function FullText({ paragraphs, excerpt = true, language }: { paragraphs: string[]; excerpt?: boolean; language?: 'ko'|'en' }) {
  if (!paragraphs.length) return <p className={styles.muted}>등록된 소개가 없습니다.</p>;
  const text = paragraphs.join('\n\n');
  return <div className={styles.prose} lang={language}>{excerpt && text.length > 260 ? <><p>{text.slice(0,240)}…</p><details><summary lang="ko">전체 읽기</summary>{paragraphs.map((p,i) => <p key={i}>{p}</p>)}</details></> : paragraphs.map((p,i) => <p key={i}>{p}</p>)}</div>;
}
export { styles as ui };
