import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi } from 'vitest';

await i18n.use(initReactI18next).init({
  lng: 'cimode',
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

vi.mock('common/api/osrdEditoastApi');
