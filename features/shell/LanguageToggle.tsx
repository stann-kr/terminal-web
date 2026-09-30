'use client';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

/**
 * The language of a text that comes in two (a briefing, a biography, the introduction), switched
 * where it is read. The choice holds for every such text and is remembered in this browser.
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <span className={styles.language} role="group" aria-label="소개글 언어">
      {(['ko', 'en'] as const).map(lang => (
        <button key={lang} type="button" lang={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
          {lang.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
