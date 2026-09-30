'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { chooseLanguage, readLanguage, serverLanguage, subscribeLanguage } from './language';

/** The content language (see ./language): read from the browser, the same wherever it is used. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, readLanguage, serverLanguage);
  return { language, setLanguage: chooseLanguage };
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
