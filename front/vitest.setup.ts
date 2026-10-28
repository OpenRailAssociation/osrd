import { cleanup } from '@testing-library/react';
import { use as i18nUse } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi, afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

await i18nUse(initReactI18next).init({
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
