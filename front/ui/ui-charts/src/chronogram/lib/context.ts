import { createContext } from 'react';

import { type ChronogramContextType } from './types';

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated.
 */
export const ChronogramContext = createContext<ChronogramContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as ChronogramContextType
);
