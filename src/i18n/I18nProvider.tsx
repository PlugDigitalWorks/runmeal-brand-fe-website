'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './config';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Avoid hydration mismatch: render children only after i18n is ready on client.
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) return;
    const onInit = () => setReady(true);
    i18n.on('initialized', onInit);
    return () => i18n.off('initialized', onInit);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const syncDocumentLanguage = (language?: string) => {
      document.documentElement.lang = (language || i18n.resolvedLanguage || i18n.language || 'tr').slice(0, 2);
    };
    syncDocumentLanguage();
    i18n.on('languageChanged', syncDocumentLanguage);
    return () => i18n.off('languageChanged', syncDocumentLanguage);
  }, [ready]);

  if (!ready) return null;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
