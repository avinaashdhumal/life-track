import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import es from './locales/es.json';

export interface SupportedLanguage {
  code: 'en' | 'hi' | 'mr' | 'es';
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' }
];

const LANGUAGE_STORAGE_KEY = 'lifetrack_user_language';

const getInitialLanguage = (): string => {
  // Check localStorage if available in web / hybrid runtime
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && ['en', 'hi', 'mr', 'es'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore storage access errors
    }
  }

  // Detect device locale from expo-localization
  try {
    const deviceLocales = Localization.getLocales();
    if (deviceLocales && deviceLocales.length > 0) {
      const primaryLang = deviceLocales[0].languageCode?.toLowerCase();
      if (primaryLang && ['en', 'hi', 'mr', 'es'].includes(primaryLang)) {
        return primaryLang;
      }
    }
  } catch {
    // fallback to default
  }

  return 'en';
};

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
  es: { translation: es }
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  });
}

export const changeLanguage = async (langCode: 'en' | 'hi' | 'mr' | 'es') => {
  await i18n.changeLanguage(langCode);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
    } catch {
      // ignore storage write errors
    }
  }
};

export const getCurrentLanguage = (): 'en' | 'hi' | 'mr' | 'es' => {
  const current = i18n.language || 'en';
  if (['en', 'hi', 'mr', 'es'].includes(current)) {
    return current as 'en' | 'hi' | 'mr' | 'es';
  }
  return 'en';
};

export default i18n;
