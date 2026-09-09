import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi, afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

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
