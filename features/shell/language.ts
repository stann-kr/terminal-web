/**
 * The content language (event briefings, biographies, the introduction). It is not a site-wide
 * switch: only those texts come in two languages. A visitor's own choice is kept in this browser;
 * without one, the browser's languages decide (any Korean → ko, else en). The server always renders
 * ko, and the client reads its choice while the boot screen is still up.
 */
export type Language = 'ko' | 'en';

const KEY = 'terminal:language';
let chosen: Language | null = null;
const listeners = new Set<() => void>();

export function readLanguage(): Language {
  if (chosen) return chosen;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    // Storage may be blocked; fall back to the browser's languages.
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some(language => /^ko\b/i.test(language ?? '')) ? 'ko' : 'en';
}

export const serverLanguage = (): Language => 'ko';

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function chooseLanguage(language: Language) {
  chosen = language;
  try {
    window.localStorage.setItem(KEY, language);
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach(listener => listener());
}
