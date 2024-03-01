import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-xhr-backend';
import { initReactI18next } from 'react-i18next';

// Official languages codes to use from IANA
// https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: ['fr', 'en'],
    debug: false,
    supportedLngs: ['en', 'fr'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Errors namespace must be initialized so t function
// can be used in plain old function (see utils/error)
i18n.loadNamespaces('errors');

export default i18n;
