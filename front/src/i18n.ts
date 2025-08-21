import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

// Official languages codes to use from IANA
// https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

const version = encodeURIComponent(import.meta.env.VITE_OSRD_GIT_DESCRIBE);

export const supportedLngs = ['de', 'en', 'fr', 'pt'];

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: ['en', 'fr'],
    debug: false,
    supportedLngs,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    backend: {
      loadPath: `/locales/{{lng}}/{{ns}}.json?v=${version}`,
    },
  });

// Errors namespace must be initialized so t function
// can be used in plain old function (see utils/error)
i18n.loadNamespaces('errors');

export default i18n;
