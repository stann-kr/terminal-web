'use client';
import { useLanguage } from './Providers';
import styles from './shell.module.css';

/** Content language (event briefings, biographies, the introduction). */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={styles.language} role="group" aria-label="콘텐츠 언어">
      {(['ko', 'en'] as const).map(lang => (
        <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
