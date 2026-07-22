import { createContext } from 'react';

import type { CanvasContextType, TimeChartContextType, MouseContextType } from './types';

export const TimeChartCanvasContext = createContext<CanvasContextType<TimeChartContextType>>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<TimeChartContextType>
);

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated or the mouse moves.
 */
export const MouseContext = createContext<MouseContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as MouseContextType
);
