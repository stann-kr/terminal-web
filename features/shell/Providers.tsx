'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

type Language = 'ko' | 'en';
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'ko', setLanguage: () => {} });
export const useLanguage = () => useContext(LanguageContext);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } }));
  const [language, setLanguage] = useState<Language>('ko');
  return <QueryClientProvider client={client}><LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider></QueryClientProvider>;
}
