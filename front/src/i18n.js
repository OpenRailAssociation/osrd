import Backend from 'i18next-xhr-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Official languages codes to use from IANA
// https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: ['fr', 'en', 'de', 'es', 'it', 'jp', 'uk'],
    debug: false,
    supportedLngs: ['de', 'en', 'es', 'fr', 'it', 'jp', 'ru', 'uk'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
