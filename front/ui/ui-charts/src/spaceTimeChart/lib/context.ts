import { createContext } from 'react';

import type { CanvasContextType } from '../../common/types';
import type { SpaceTimeChartContextType } from './types';

// There are two different contexts because they have very different lifecycles:
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
