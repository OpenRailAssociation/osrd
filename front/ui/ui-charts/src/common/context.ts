import { createContext } from 'react';

import type { CanvasContextType, TimeChartContextType } from './types';

export const TimeChartCanvasContext = createContext<CanvasContextType<TimeChartContextType>>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<TimeChartContextType>
);
