import { createContext } from 'react';

import type { CanvasContextType } from './types';

/**
 * This context only contains necessary helpers to (un)register drawing functions.
 * It is basically never updated.
 */
export const CanvasContext = createContext<CanvasContextType<unknown>>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<unknown>
);
