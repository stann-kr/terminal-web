/** The console null mark: a ring crossed by two diagonals. Decorative. */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="20" cy="20" r="17" />
      <path d="M8 8 32 32M32 8 8 32" />
    </svg>
  );
}
