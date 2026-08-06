'use client';

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config';

const LABELS: Record<SupportedLanguage, string> = {
  tr: 'TR',
  en: 'EN',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'tr').slice(0, 2);

  const next = () => {
    const idx = SUPPORTED_LANGUAGES.indexOf(current as SupportedLanguage);
    const target = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
    i18n.changeLanguage(target);
  };

  return (
    <button
      type="button"
      onClick={next}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-sm"
      aria-label="Change language"
    >
      <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span>{LABELS[current as SupportedLanguage] ?? current.toUpperCase()}</span>
    </button>
  );
}
