'use client';

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  LANGUAGE_CHOICE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n/config';

const LABELS: Record<SupportedLanguage, string> = {
  tr: 'TR',
  en: 'EN',
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'tr').slice(0, 2);
  const idx = SUPPORTED_LANGUAGES.indexOf(current as SupportedLanguage);
  // The button shows the language it switches to, not the active one.
  const target = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];

  const next = () => {
    i18n.changeLanguage(target);
    try {
      localStorage.setItem(LANGUAGE_CHOICE_STORAGE_KEY, target);
    } catch {
      // Storage unavailable (private mode etc.): the switch still applies to this page view.
    }
  };

  return (
    <button
      type="button"
      onClick={next}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-sm"
      aria-label={t('common.changeLanguage')}
    >
      <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span>{LABELS[target]}</span>
    </button>
  );
}
