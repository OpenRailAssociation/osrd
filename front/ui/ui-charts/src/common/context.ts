import { createContext } from 'react';

import type { CanvasContextType, ChartContextType } from './types';

export const BaseChartCanvasContext = createContext<CanvasContextType<ChartContextType>>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<ChartContextType>
);
