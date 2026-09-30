'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { TerminalEvent } from '@/lib/events/types';

type Language = 'ko' | 'en';
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'ko', setLanguage: () => {} });
export const useLanguage = () => useContext(LanguageContext);

export function Providers({ children, initialEvents }: {
  children: ReactNode;
  initialEvents?: { events: TerminalEvent[]; updatedAt: number };
}) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } });
    if (initialEvents) queryClient.setQueryData(['events'], initialEvents.events, { updatedAt: initialEvents.updatedAt });
    return queryClient;
  });
  const [language, setLanguage] = useState<Language>('ko');
  return <QueryClientProvider client={client}><LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider></QueryClientProvider>;
}
