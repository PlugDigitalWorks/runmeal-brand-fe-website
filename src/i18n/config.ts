import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { COUNTRY_COOKIE_NAME } from './country';

import tr from './locales/tr/common.json';
import en from './locales/en/common.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'tr';

// Only written when the visitor picks a language with the switcher, so an
// explicit choice beats the country default. (The old `runmeal_lang` key also
// cached the browser language for every visitor, hence the new key.)
export const LANGUAGE_CHOICE_STORAGE_KEY = 'runmeal_lang_choice';

// Turkish for visitors in Turkey, English everywhere else. Without the cookie
// (e.g. local dev, no Cloudflare in front) detection falls back to DEFAULT_LANGUAGE.
const countryDetector = {
  name: 'country',
  lookup() {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE_NAME}=([^;]+)`));
    if (!match) return undefined;
    return match[1].toUpperCase() === 'TR' ? 'tr' : 'en';
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(countryDetector);

if (!i18n.isInitialized) {
  i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        tr: { common: tr },
        en: { common: en },
      },
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      defaultNS: 'common',
      ns: ['common'],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'country'],
        lookupLocalStorage: LANGUAGE_CHOICE_STORAGE_KEY,
        caches: [],
      },
    });
}

export default i18n;
