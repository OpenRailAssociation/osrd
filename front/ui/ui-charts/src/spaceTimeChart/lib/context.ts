import { createContext } from 'react';

import type { CanvasContextType } from '../../common/types';
import type { MouseContextType, SpaceTimeChartContextType } from './types';

// There are three different contexts because they have very different lifecycles:
// - MouseContext
// - SpaceTimeChartContext
// - SpaceTimeChartCanvasContext

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated.
 */
export const SpaceTimeChartContext = createContext<SpaceTimeChartContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as SpaceTimeChartContextType
);

export const SpaceTimeChartCanvasContext = createContext<
  CanvasContextType<SpaceTimeChartContextType>
>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<SpaceTimeChartContextType>
);

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated or the mouse moves.
 */
export const MouseContext = createContext<MouseContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as MouseContextType
);
